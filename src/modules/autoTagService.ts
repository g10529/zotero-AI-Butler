import { getPref } from "../utils/prefs";
import {
  buildAutoTagPrompt,
  getDefaultAutoTagList,
  parseAutoTagList,
} from "../utils/autoTags";
import { PDFExtractor } from "./pdfExtractor";
import { LLMClient } from "./llmClient";

type AutoTagResult = {
  addedTags: string[];
  chosenTags: string[];
  skipped: boolean;
  reason?: string;
};

export class AutoTagService {
  public static isEnabled(): boolean {
    return (getPref("autoTagEnabled" as any) as boolean) ?? false;
  }

  public static async generateAndApplyTags(
    item: Zotero.Item,
  ): Promise<AutoTagResult> {
    if (!this.isEnabled()) {
      return {
        addedTags: [],
        chosenTags: [],
        skipped: true,
        reason: "disabled",
      };
    }

    const rawList =
      (getPref("autoTagList" as any) as string) || getDefaultAutoTagList();
    const { tags: allowedTags } = parseAutoTagList(rawList);

    if (!allowedTags.length) {
      return {
        addedTags: [],
        chosenTags: [],
        skipped: true,
        reason: "empty-tag-list",
      };
    }

    const base64Pdf = await PDFExtractor.extractBase64FromItem(item);
    const title = ((item.getField("title") as string) || "").trim();
    const abstract = ((item.getField("abstractNote") as string) || "").trim();

    const response = await LLMClient.generateSummaryWithRetry(
      base64Pdf,
      true,
      buildAutoTagPrompt(title, abstract, allowedTags),
    );

    if (!response || !response.trim()) {
      ztoolkit.log("[AI-Butler] 自动标签模型返回空字符串");
      return {
        addedTags: [],
        chosenTags: [],
        skipped: true,
        reason: "empty-response",
      };
    }

    const chosenTags = this.parseModelTags(response, allowedTags);
    if (!chosenTags.length) {
      ztoolkit.log(
        "[AI-Butler] 自动标签未命中有效标签，模型原始输出预览:",
        response.slice(0, 1000),
      );
      return {
        addedTags: [],
        chosenTags: [],
        skipped: true,
        reason: "no-valid-tags",
      };
    }

    const existingTags: Array<{ tag: string }> = (item as any).getTags?.() || [];
    const existingSet = new Set(existingTags.map((entry) => entry.tag));
    const addedTags: string[] = [];

    for (const tag of chosenTags) {
      if (existingSet.has(tag)) continue;
      item.addTag(tag);
      addedTags.push(tag);
    }

    if (addedTags.length) {
      await item.saveTx();
    }

    return {
      addedTags,
      chosenTags,
      skipped: false,
    };
  }

  private static parseModelTags(
    raw: string,
    allowedTags: string[],
  ): string[] {
    const allowedSet = new Set(allowedTags);
    const parsed = this.parseJsonPayload(raw);
    const modelTags: unknown[] = Array.isArray(parsed?.tags) ? parsed.tags : [];
    const jsonTags = Array.from(
      new Set(
        modelTags
          .map((tag: unknown) => (typeof tag === "string" ? tag.trim() : ""))
          .filter(
            (tag: string): tag is string => !!tag && allowedSet.has(tag),
          ),
      ),
    );

    if (jsonTags.length) {
      return jsonTags;
    }

    // 兼容模型没有严格输出 JSON，而是直接把标签写在正文中的情况。
    const directMatches = allowedTags.filter((tag) => raw.includes(tag));
    if (directMatches.length) {
      return Array.from(new Set(directMatches));
    }

    return [];
  }

  private static parseJsonPayload(raw: string): any {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
      try {
        return JSON.parse(fencedMatch[1]);
      } catch {
        // fall through
      }
    }

    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // fall through
      }
    }

    return null;
  }
}

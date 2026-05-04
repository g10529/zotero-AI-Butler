import { getPref } from "../utils/prefs";
import {
  buildAutoTagPrompt,
  getDefaultAutoTagList,
  parseAutoTagList,
  parseAutoTagResponse,
} from "../utils/autoTags";
import LLMService from "./llmService";

export type AutoTagResult = {
  addedTags: string[];
  chosenTags: string[];
  skipped: boolean;
  reason?: string;
};

export class AutoTagService {
  public static getAllowedTags(): string[] {
    const rawList =
      (getPref("autoTagList" as any) as string) || getDefaultAutoTagList();
    return parseAutoTagList(rawList).tags;
  }

  public static itemHasAllowedTag(item: Zotero.Item): boolean {
    const allowedTags = new Set(this.getAllowedTags());
    if (!allowedTags.size) return false;
    const existingTags: Array<{ tag: string }> =
      (item as any).getTags?.() || [];
    return existingTags.some((entry) => allowedTags.has(entry.tag));
  }

  public static async generateAndApplyTags(
    item: Zotero.Item,
  ): Promise<AutoTagResult> {
    const allowedTags = this.getAllowedTags();

    if (!allowedTags.length) {
      return {
        addedTags: [],
        chosenTags: [],
        skipped: true,
        reason: "empty-tag-list",
      };
    }

    const title = ((item.getField("title") as string) || "").trim();
    const abstract = ((item.getField("abstractNote") as string) || "").trim();
    const prompt = buildAutoTagPrompt(title, abstract, allowedTags);

    const response = await LLMService.generateText({
      task: "custom",
      prompt,
      content: {
        kind: "zotero-item",
        item,
        policy: "auto",
        attachmentMode: "default",
        maxAttachments: 1,
      },
      output: { format: "json" },
      transport: { stream: false },
    });

    if (!response || !response.trim()) {
      ztoolkit.log("[AI-Butler] 自动标签模型返回空字符串");
      return {
        addedTags: [],
        chosenTags: [],
        skipped: true,
        reason: "empty-response",
      };
    }

    const chosenTags = parseAutoTagResponse(response, allowedTags);
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

    const existingTags: Array<{ tag: string }> =
      (item as any).getTags?.() || [];
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
}

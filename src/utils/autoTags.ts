/**
 * Utilities for AI-assisted Zotero item tagging.
 */

export const DEFAULT_AUTO_TAG_LIST = `#研究主题/请替换为你的一级主题/请替换为具体方向
#研究方法/请替换为方法类别/请替换为具体方法
#研究对象/请替换为对象类别/请替换为具体对象
#数据类型/请替换为数据类别
#应用场景/请替换为应用领域
#结论类型/请替换为主要发现类型`;

export function getDefaultAutoTagList(): string {
  return DEFAULT_AUTO_TAG_LIST;
}

export function normalizeAutoTagLine(line: string): string {
  return line.trim().replace(/\s+/g, " ");
}

export function parseAutoTagList(raw: string): {
  tags: string[];
  invalidLines: string[];
  duplicateLines: string[];
} {
  const tags: string[] = [];
  const invalidLines: string[] = [];
  const duplicateLines: string[] = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const normalized = normalizeAutoTagLine(line);
    if (!normalized) continue;

    if (
      !normalized.startsWith("#") ||
      normalized.includes("//") ||
      normalized.endsWith("/")
    ) {
      invalidLines.push(normalized);
      continue;
    }

    if (seen.has(normalized)) {
      duplicateLines.push(normalized);
      continue;
    }

    seen.add(normalized);
    tags.push(normalized);
  }

  return { tags, invalidLines, duplicateLines };
}

export function summarizeAutoTagList(tags: string[]): {
  total: number;
  roots: string[];
} {
  const roots = Array.from(
    new Set(
      tags
        .map((tag) => tag.split("/")[0]?.trim())
        .filter((tag): tag is string => !!tag),
    ),
  );

  return {
    total: tags.length,
    roots,
  };
}

export function buildAutoTagPrompt(
  title: string,
  abstract: string,
  allowedTags: string[],
): string {
  const metadataLines = [
    title ? `标题：${title}` : "",
    abstract ? `摘要：${abstract}` : "",
  ].filter(Boolean);

  return [
    "你是一名学术文献自动打标签助手。",
    "请阅读我提供的论文内容，并仅从候选标签列表中选择最合适的标签。",
    "你必须遵守以下规则：",
    "1. 只能使用候选标签列表中的标签，绝不能自造标签。",
    "2. 标签必须尽量选择最深层级；如果更深层级明确适用，不要只返回父级标签。",
    "3. 若某方法只是背景提及，而不是实验方法、结果分析或重点讨论内容，则不要打该标签。",
    "4. 若文献同时明确涉及宏观性能和表征方法，两类标签都应选择。",
    "5. 可以返回多个标签，但只返回真正被论文内容明确支持的标签。",
    "6. 不要输出解释、不要输出 Markdown、不要输出代码块、不要寒暄。",
    "7. 无论是否命中标签，都必须返回一个非空 JSON 对象，禁止返回空字符串。",
    '唯一允许的输出格式是：{"tags":["#标签1","#标签2"],"reason":"简短说明"}',
    '如果没有任何合适标签，必须输出：{"tags":[],"reason":"未命中"}',
    metadataLines.length ? `文献信息：\n${metadataLines.join("\n")}` : "",
    `候选标签列表（仅可从这里选择）：\n${allowedTags.join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function parseAutoTagResponse(
  raw: string,
  allowedTags: string[],
): string[] {
  const allowedSet = new Set(allowedTags);
  const parsed = parseJsonPayload(raw);
  const modelTags: unknown[] = Array.isArray(parsed?.tags) ? parsed.tags : [];
  const jsonTags = Array.from(
    new Set(
      modelTags
        .map((tag: unknown) => (typeof tag === "string" ? tag.trim() : ""))
        .filter((tag: string): tag is string => !!tag && allowedSet.has(tag)),
    ),
  );

  if (jsonTags.length) return jsonTags;

  const directMatches = allowedTags.filter((tag) => raw.includes(tag));
  return Array.from(new Set(directMatches));
}

function parseJsonPayload(raw: string): any {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Try common non-strict model formats below.
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1]);
    } catch {
      // Fall through.
    }
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // Fall through.
    }
  }

  return null;
}

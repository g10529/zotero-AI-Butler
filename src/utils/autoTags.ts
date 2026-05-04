/**
 * Utilities for AI-assisted Zotero item tagging.
 */

export const DEFAULT_AUTO_TAG_LIST = `#性能/力学性能/抗压强度
#性能/力学性能/抗折强度
#性能/力学性能/粘结强度
#性能/力学性能/强度发展
#性能/工作性/流动度
#性能/工作性/坍落度
#性能/工作性/流变性
#性能/工作性/经时损失
#性能/凝结时间
#性能/凝结时间/初凝
#性能/凝结时间/终凝
#性能/安定性
#性能/安定性/膨胀率
#性能/安定性/收缩/自收缩
#性能/安定性/收缩/干缩
#性能/安定性/收缩/化学收缩
#性能/耐久性
#性能/耐久性/抗冻性
#性能/耐久性/抗渗性
#性能/耐久性/抗硫酸盐侵蚀
#性能/耐久性/抗氯盐侵蚀
#性能/耐久性/抗碳化
#性能/耐久性/盐冻
#性能/防冻性
#性能/防冻性/抗冻临界强度
#性能/防冻性/冻胀率
#性能/防冻性/负温强度发展
#表征/TG-DSC
#表征/TG-DSC/物相定量
#表征/TG-DSC/分解温度
#表征/XRD
#表征/XRD/物相鉴定
#表征/XRD/Rietveld精修
#表征/XRD/原位XRD
#表征/FTIR
#表征/FTIR/官能团归属
#表征/Raman
#表征/Raman/物相鉴定
#表征/NMR
#表征/NMR/27Al-NMR
#表征/NMR/29Si-NMR
#表征/NMR/1H-NMR
#表征/SEM
#表征/SEM/形貌
#表征/SEM/EDS
#表征/SEM/BSE
#表征/TEM
#表征/TEM/形貌
#表征/TEM/SAED
#表征/TEM/HR-TEM
#表征/MIP
#表征/MIP/孔径分布
#表征/MIP/总孔隙率
#表征/BET
#表征/BET/比表面积
#表征/BET/孔径分布
#表征/孔溶液
#表征/孔溶液/离子浓度
#表征/孔溶液/pH
#表征/孔溶液/饱和指数
#表征/IC
#表征/ICP
#表征/TOC
#表征/等温量热
#表征/等温量热/水化放热速率
#表征/等温量热/累积放热量
#表征/XPS
#表征/纳米压痕
#表征/XRF
#表征/粒度分析`;

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

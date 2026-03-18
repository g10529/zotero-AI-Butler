import { DEFAULT_TABLE_TEMPLATE } from "../../utils/prompts";

export function normalizeTableEntryName(entry: string): string {
  return entry.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseMarkdownTableCells(line: string): string[] {
  const content = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return content.split("|").map((cell) => cell.trim());
}

export function isMarkdownSeparatorRow(cells: string[]): boolean {
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")))
  );
}

export function parseTableTemplateEntries(template: string): string[] {
  const entries: string[] = [];
  const seen = new Set<string>();

  for (const line of template.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    const cells = parseMarkdownTableCells(trimmed);
    if (cells.length < 2 || isMarkdownSeparatorRow(cells)) continue;

    const first = cells[0].trim();
    const normalizedFirst = normalizeTableEntryName(first);
    if (!normalizedFirst) continue;
    if (
      normalizedFirst === "维度" ||
      normalizedFirst === "dimension" ||
      normalizedFirst === "field"
    ) {
      continue;
    }
    if (seen.has(normalizedFirst)) continue;

    seen.add(normalizedFirst);
    entries.push(first);
  }

  return entries;
}

export function buildTableTemplateFromEntries(entries: string[]): string {
  if (entries.length === 0) {
    return DEFAULT_TABLE_TEMPLATE;
  }

  const rows = entries.map((entry) => `| ${entry} | |`);
  return ["| 维度 | 内容 |", "|------|------|", ...rows].join("\n");
}

export function mergeUniqueEntries(groups: string[][]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const entry of group) {
      const value = entry.trim();
      if (!value) continue;

      const normalized = normalizeTableEntryName(value);
      if (!normalized || seen.has(normalized)) continue;

      seen.add(normalized);
      merged.push(value);
    }
  }

  return merged;
}

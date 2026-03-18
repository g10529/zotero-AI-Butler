/**
 * ================================================================
 * 文献综述服务
 * ================================================================
 *
 * 本模块只保留当前在用的表格驱动综述流程：
 * 1. 逐篇文献按表格模板填表（并行，可复用已有表格）
 * 2. 汇总表格内容生成文献综述/针对性回答
 * 3. 生成独立笔记
 *
 * @module literatureReviewService
 */

import { marked } from "marked";
import { PDFExtractor } from "./pdfExtractor";
import LLMClient from "./llmClient";
import { NoteGenerator } from "./noteGenerator";
import { getPref } from "../utils/prefs";
import {
  DEFAULT_TABLE_FILL_PROMPT,
  DEFAULT_TABLE_REVIEW_PROMPT,
  DEFAULT_TABLE_TEMPLATE,
} from "../utils/prompts";
import {
  buildTableTemplateFromEntries,
  isMarkdownSeparatorRow,
  normalizeTableEntryName,
  parseMarkdownTableCells,
} from "./literatureReview/tableUtils";

type TableStrategy = "skip" | "overwrite";

const TABLE_NOTE_TAG = "AI-Table";

interface TargetedAnswerOptions {
  selectedTableEntries?: string[];
  appendedTableEntries?: string[];
}

interface ItemPdfPair {
  parentItem: Zotero.Item;
  pdfAttachment: Zotero.Item;
}

export class LiteratureReviewService {
  static async generateReview(
    collection: Zotero.Collection,
    pdfAttachments: Zotero.Item[],
    reviewName: string,
    prompt: string,
    tableTemplateOverride?: string,
    progressCallback?: (message: string, progress: number) => void,
  ): Promise<Zotero.Item> {
    const tableTemplate =
      tableTemplateOverride ||
      (getPref("tableTemplate" as any) as string) ||
      DEFAULT_TABLE_TEMPLATE;
    const fillPrompt =
      (getPref("tableFillPrompt" as any) as string) ||
      DEFAULT_TABLE_FILL_PROMPT;
    const reviewPrompt =
      prompt ||
      (getPref("tableReviewPrompt" as any) as string) ||
      DEFAULT_TABLE_REVIEW_PROMPT;
    const concurrency = (getPref("tableFillConcurrency" as any) as number) || 3;
    const itemPdfPairs = await this.buildItemPdfPairs(pdfAttachments);

    progressCallback?.("正在逐篇填表...", 10);
    const tableResults = await this.fillTablesInParallel(
      itemPdfPairs,
      tableTemplate,
      fillPrompt,
      concurrency,
      undefined,
      (done, total) => {
        const progress = 10 + Math.floor((done / total) * 50);
        progressCallback?.(`正在填表 (${done}/${total})...`, progress);
      },
    );

    progressCallback?.("正在汇总表格...", 65);
    const aggregated = this.aggregateTableContents(tableResults, itemPdfPairs);

    progressCallback?.("正在生成综述...", 70);
    let summaryContent = await LLMClient.generateSummaryWithRetry(
      aggregated,
      false,
      `${reviewPrompt}\n\n以下提供的内容是各文献的结构化信息表格，请基于这些表格生成综述。`,
    );
    summaryContent = await this.postProcessCitations(
      summaryContent,
      itemPdfPairs,
    );

    progressCallback?.("正在创建笔记...", 90);
    const reviewNote = await this.createStandaloneReviewNote(
      collection,
      reviewName,
      summaryContent,
    );

    progressCallback?.("完成!", 100);
    return reviewNote;
  }

  static async generateTargetedAnswer(
    collection: Zotero.Collection,
    pdfAttachments: Zotero.Item[],
    noteTitle: string,
    questionPrompt: string,
    tableTemplateOverride?: string,
    options?: TargetedAnswerOptions,
    progressCallback?: (message: string, progress: number) => void,
  ): Promise<Zotero.Item> {
    const tableTemplate =
      tableTemplateOverride ||
      (getPref("tableTemplate" as any) as string) ||
      DEFAULT_TABLE_TEMPLATE;
    const fillPrompt =
      (getPref("tableFillPrompt" as any) as string) ||
      DEFAULT_TABLE_FILL_PROMPT;
    const concurrency = (getPref("tableFillConcurrency" as any) as number) || 3;
    const itemPdfPairs = await this.buildItemPdfPairs(pdfAttachments, true);
    const appendedTableEntries = Array.from(
      new Set(
        (options?.appendedTableEntries || [])
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    );

    progressCallback?.("正在逐篇填表...", 10);
    const tableResults =
      appendedTableEntries.length > 0
        ? await this.appendTableEntriesInParallel(
            itemPdfPairs,
            appendedTableEntries,
            fillPrompt,
            concurrency,
            (done, total) => {
              const progress = 10 + Math.floor((done / total) * 50);
              progressCallback?.(`正在追加填表 (${done}/${total})...`, progress);
            },
          )
        : await this.fillTablesInParallel(
            itemPdfPairs,
            tableTemplate,
            fillPrompt,
            concurrency,
            undefined,
            (done, total) => {
              const progress = 10 + Math.floor((done / total) * 50);
              progressCallback?.(`正在填表 (${done}/${total})...`, progress);
            },
          );

    const selectedTableEntries = Array.from(
      new Set(
        (options?.selectedTableEntries || [])
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    );
    const filteredTableResults = this.filterTableResultsByEntries(
      tableResults,
      selectedTableEntries,
    );

    progressCallback?.("正在汇总表格...", 65);
    const aggregated = this.aggregateTableContents(
      filteredTableResults,
      itemPdfPairs,
    );
    const selectedEntriesInstruction =
      selectedTableEntries.length > 0
        ? `\n\n请仅使用以下表格条目回答问题：${selectedTableEntries.join("、")}。若条目证据不足，请明确说明。`
        : "";

    progressCallback?.("正在回答问题...", 75);
    let answerContent = await LLMClient.generateSummaryWithRetry(
      aggregated,
      false,
      `${questionPrompt}${selectedEntriesInstruction}\n\n以下提供的内容是各文献的结构化信息表格，请基于这些表格回答问题。`,
    );
    answerContent = await this.postProcessCitations(
      answerContent,
      itemPdfPairs,
    );

    progressCallback?.("正在创建笔记...", 90);
    const note = await this.createStandaloneReviewNote(
      collection,
      noteTitle,
      answerContent,
    );

    progressCallback?.("完成!", 100);
    return note;
  }

  static async fillTableForSinglePDF(
    item: Zotero.Item,
    pdfAttachment: Zotero.Item,
    tableTemplate: string,
    fillPrompt: string,
    progressCallback?: (message: string, progress: number) => void,
  ): Promise<string> {
    const itemTitle = (item.getField("title") as string) || "未知标题";
    progressCallback?.(`正在提取 PDF: ${itemTitle.slice(0, 30)}...`, 10);

    const filePath = await pdfAttachment.getFilePathAsync();
    if (!filePath) {
      throw new Error(`PDF 附件无文件路径: ${pdfAttachment.id}`);
    }

    let pdfContent: string;
    let isBase64 = false;

    try {
      const fileData = await IOUtils.read(filePath);
      pdfContent = this.arrayBufferToBase64(fileData);
      isBase64 = true;
    } catch {
      pdfContent = await PDFExtractor.extractTextFromItem(item);
    }

    progressCallback?.(`正在填表: ${itemTitle.slice(0, 30)}...`, 50);
    const result = await LLMClient.generateSummaryWithRetry(
      pdfContent,
      isBase64,
      fillPrompt.replace(/\$\{tableTemplate\}/g, tableTemplate),
    );
    progressCallback?.(`填表完成: ${itemTitle.slice(0, 30)}`, 100);
    return result;
  }

  static async findTableNote(item: Zotero.Item): Promise<string | null> {
    try {
      const noteIDs = (item as any).getNotes?.() || [];
      for (const nid of noteIDs) {
        const note = await Zotero.Items.getAsync(nid);
        if (!note) continue;

        const tags: Array<{ tag: string }> = (note as any).getTags?.() || [];
        if (!tags.some((t) => t.tag === TABLE_NOTE_TAG)) continue;

        const noteContent: string = (note as any).getNote?.() || "";
        const rawMatch = noteContent.match(
          /<(?:div|pre)[^>]*data-ai-table-raw[^>]*>([\s\S]*?)<\/(?:div|pre)>/,
        );
        if (rawMatch?.[1]) {
          return rawMatch[1]
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .trim();
        }

        const textContent = noteContent.replace(/<[^>]*>/g, "").trim();
        return textContent || null;
      }
    } catch {
      return null;
    }

    return null;
  }

  static async saveTableNote(
    item: Zotero.Item,
    tableContent: string,
    forceOverwrite: boolean = false,
  ): Promise<Zotero.Item> {
    const strategy: TableStrategy = ((getPref(
      "tableStrategy" as any,
    ) as string) || "skip") as TableStrategy;
    const noteIDs = (item as any).getNotes?.() || [];
    let existingNote: Zotero.Item | null = null;

    for (const nid of noteIDs) {
      const note = await Zotero.Items.getAsync(nid);
      if (!note) continue;
      const tags: Array<{ tag: string }> = (note as any).getTags?.() || [];
      if (tags.some((t) => t.tag === TABLE_NOTE_TAG)) {
        existingNote = note;
        break;
      }
    }

    if (existingNote) {
      if (!forceOverwrite && strategy === "skip") {
        return existingNote;
      }
      await (existingNote as any).eraseTx?.();
    }

    const itemTitle = ((item.getField("title") as string) || "未知").slice(
      0,
      60,
    );
    marked.setOptions({ gfm: true, breaks: true });
    let renderedHtml = marked.parse(tableContent) as string;
    renderedHtml = renderedHtml.replace(/\s+style="[^"]*"/g, "");
    renderedHtml = renderedHtml.replace(
      /\$\$([\s\S]*?)\$\$/g,
      (_match, formula) =>
        `<span class="math">$\\displaystyle ${formula.trim()}$</span>`,
    );
    renderedHtml = renderedHtml.replace(
      /(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/g,
      (_match, formula) => `<span class="math">$${formula.trim()}$</span>`,
    );

    const escapedRaw = tableContent
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const note = new Zotero.Item("note");
    note.libraryID = item.libraryID;
    note.parentID = item.id;
    note.setNote(
      `<h2>📊 文献表格 - ${itemTitle}</h2><div>${renderedHtml}</div><div style="display:none" data-ai-table-raw>${escapedRaw}</div>`,
    );
    note.addTag(TABLE_NOTE_TAG);
    await note.saveTx();
    return note;
  }

  static aggregateTableContents(
    tableResults: Map<number, string>,
    itemPdfPairs?: ItemPdfPair[],
  ): string {
    const itemMap = new Map<number, Zotero.Item>();
    for (const pair of itemPdfPairs || []) {
      itemMap.set(pair.parentItem.id, pair.parentItem);
    }

    let globalHeader = "";
    const parts: string[] = [];
    let index = 1;

    for (const [itemId, tableContent] of tableResults) {
      const parentItem = itemMap.get(itemId);
      const { header, dataRows, nonTableContent } =
        this.splitTableHeaderAndRows(tableContent);

      if (!globalHeader && header) {
        globalHeader = header;
      }

      let entry = parentItem
        ? `> **[${index}] 文献**: ${((parentItem.getField("title") as string) || "").slice(0, 80)} (${this.extractAuthorSurname(parentItem)}, ${this.extractYear(parentItem)})`
        : `> **[${index}] 文献**`;

      if (nonTableContent) entry += `\n${nonTableContent}`;
      entry += `\n${dataRows || tableContent}`;

      parts.push(entry);
      index++;
    }

    if (!globalHeader) {
      return parts.join("\n\n---\n\n");
    }

    return `**表格结构定义（以下每篇文献的数据行均遵循此表头）：**\n\n${globalHeader}\n\n---\n\n${parts.join("\n\n---\n\n")}`;
  }

  static async fillTablesInParallel(
    items: ItemPdfPair[],
    tableTemplate: string,
    fillPrompt: string,
    concurrency: number,
    options?: {
      forceFillExisting?: boolean;
      forceOverwriteSave?: boolean;
    },
    progressCallback?: (done: number, total: number) => void,
  ): Promise<Map<number, string>> {
    const results = new Map<number, string>();
    let completed = 0;
    const total = items.length;
    const queue = [...items];
    const strategy: TableStrategy = ((getPref(
      "tableStrategy" as any,
    ) as string) || "skip") as TableStrategy;

    const worker = async () => {
      while (queue.length > 0) {
        const task = queue.shift()!;
        try {
          if (strategy === "skip" && !options?.forceFillExisting) {
            const existing = await this.findTableNote(task.parentItem);
            if (existing) {
              results.set(task.parentItem.id, existing);
              completed++;
              progressCallback?.(completed, total);
              continue;
            }
          }

          const table = await this.fillTableForSinglePDF(
            task.parentItem,
            task.pdfAttachment,
            tableTemplate,
            fillPrompt,
          );
          await this.saveTableNote(
            task.parentItem,
            table,
            options?.forceOverwriteSave || false,
          );
          results.set(task.parentItem.id, table);
        } catch (error) {
          ztoolkit.log(
            `[AI-Butler] 填表失败: ${task.parentItem.getField("title")}`,
            error,
          );
          results.set(
            task.parentItem.id,
            `(填表失败: ${error instanceof Error ? error.message : String(error)})`,
          );
        }

        completed++;
        progressCallback?.(completed, total);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, total) }, () => worker()),
    );
    return results;
  }

  static async createStandaloneReviewNote(
    collection: Zotero.Collection,
    reviewName: string,
    content: string,
  ): Promise<Zotero.Item> {
    const note = new Zotero.Item("note");
    note.libraryID = collection.libraryID;
    note.setNote(NoteGenerator.formatNoteContent(reviewName, content));

    await Zotero.DB.executeTransaction(async () => {
      await note.save();
      await collection.addItem(note.id);
    });

    return note;
  }

  static async postProcessCitations(
    content: string,
    itemPdfPairs: ItemPdfPair[],
  ): Promise<string> {
    if (itemPdfPairs.length === 0) return content;

    const numToUri = new Map<number, string>();
    itemPdfPairs.forEach(({ parentItem }, idx) => {
      const itemKey = (parentItem as any).key || "";
      if (itemKey) {
        numToUri.set(idx + 1, `zotero://select/library/items/${itemKey}`);
      }
    });

    if (numToUri.size === 0) return content;

    return content.replace(/\[(\d+)\](?!\()/g, (fullMatch, numStr: string) => {
      const uri = numToUri.get(parseInt(numStr, 10));
      return uri ? `[[${numStr}]](${uri})` : fullMatch;
    });
  }

  private static async buildItemPdfPairs(
    pdfAttachments: Zotero.Item[],
    dedupeParent: boolean = false,
  ): Promise<ItemPdfPair[]> {
    const itemPdfPairs: ItemPdfPair[] = [];
    const parentSeen = new Set<number>();

    for (const pdfAtt of pdfAttachments) {
      const parentID = pdfAtt.parentID;
      if (!parentID) continue;
      if (dedupeParent && parentSeen.has(parentID)) continue;

      const parentItem = await Zotero.Items.getAsync(parentID);
      if (!parentItem) continue;

      parentSeen.add(parentID);
      itemPdfPairs.push({ parentItem, pdfAttachment: pdfAtt });
    }

    return itemPdfPairs;
  }

  private static filterTableResultsByEntries(
    tableResults: Map<number, string>,
    selectedEntries: string[],
  ): Map<number, string> {
    if (selectedEntries.length === 0) return tableResults;

    const selectedEntrySet = new Set(
      selectedEntries.map((entry) => normalizeTableEntryName(entry)).filter(Boolean),
    );
    if (selectedEntrySet.size === 0) return tableResults;

    const filteredResults = new Map<number, string>();
    for (const [itemId, tableContent] of tableResults) {
      filteredResults.set(
        itemId,
        this.filterSingleTableByEntries(tableContent, selectedEntrySet),
      );
    }
    return filteredResults;
  }

  private static filterSingleTableByEntries(
    tableContent: string,
    selectedEntries: Set<string>,
  ): string {
    const lines = tableContent.split("\n");
    const filtered: string[] = [];
    let headerCaptured = false;
    let separatorCaptured = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) {
        filtered.push(line);
        continue;
      }

      const cells = parseMarkdownTableCells(trimmed);
      if (!headerCaptured) {
        headerCaptured = true;
        filtered.push(line);
        continue;
      }
      if (!separatorCaptured && isMarkdownSeparatorRow(cells)) {
        separatorCaptured = true;
        filtered.push(line);
        continue;
      }

      const rowKey = normalizeTableEntryName(cells[0] || "");
      if (rowKey && selectedEntries.has(rowKey)) {
        filtered.push(line);
      }
    }

    return filtered.join("\n");
  }

  private static async appendTableEntriesInParallel(
    items: ItemPdfPair[],
    appendedEntries: string[],
    fillPrompt: string,
    concurrency: number,
    progressCallback?: (done: number, total: number) => void,
  ): Promise<Map<number, string>> {
    const results = new Map<number, string>();
    let completed = 0;
    const total = items.length;
    const queue = [...items];
    const appendTemplate = buildTableTemplateFromEntries(appendedEntries);
    const appendPrompt = this.buildAppendOnlyFillPrompt(
      fillPrompt,
      appendedEntries,
    );

    const worker = async () => {
      while (queue.length > 0) {
        const task = queue.shift()!;
        try {
          const existingTable = (await this.findTableNote(task.parentItem)) || "";
          const appendResult = await this.fillTableForSinglePDF(
            task.parentItem,
            task.pdfAttachment,
            appendTemplate,
            appendPrompt,
          );
          const mergedTable = this.mergeAppendRowsIntoExistingTable(
            existingTable,
            appendResult,
            appendTemplate,
            appendedEntries,
          );
          await this.saveTableNote(task.parentItem, mergedTable, true);
          results.set(task.parentItem.id, mergedTable);
        } catch (error) {
          ztoolkit.log(
            `[AI-Butler] 追加填表失败: ${task.parentItem.getField("title")}`,
            error,
          );
          results.set(
            task.parentItem.id,
            (await this.findTableNote(task.parentItem)) ||
              `(追加填表失败: ${error instanceof Error ? error.message : String(error)})`,
          );
        }

        completed++;
        progressCallback?.(completed, total);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, total) }, () => worker()),
    );
    return results;
  }

  private static buildAppendOnlyFillPrompt(
    fillPrompt: string,
    appendedEntries: string[],
  ): string {
    const entryList = appendedEntries.map((entry) => `- ${entry}`).join("\n");
    return `${fillPrompt}

【追加填表模式】
仅填写以下新增条目：
${entryList}

额外要求：
1. 不要重写已有条目
2. 只输出新增条目的 Markdown 表格（或数据行）
3. 不要输出解释性文字`;
  }

  private static mergeAppendRowsIntoExistingTable(
    existingTable: string,
    appendResult: string,
    appendTemplate: string,
    appendedEntries: string[],
  ): string {
    const allowedEntrySet = new Set(
      appendedEntries.map((entry) => normalizeTableEntryName(entry)).filter(Boolean),
    );
    const appendRowsRaw = this.extractTableDataRows(appendResult);
    const appendRows: string[] = [];
    const appendSeen = new Set<string>();

    for (const row of appendRowsRaw) {
      const rowKey = this.extractRowEntryName(row);
      if (!rowKey) continue;
      if (allowedEntrySet.size > 0 && !allowedEntrySet.has(rowKey)) continue;
      if (appendSeen.has(rowKey)) continue;
      appendSeen.add(rowKey);
      appendRows.push(row);
    }

    if (!existingTable.trim()) {
      if (appendRows.length === 0) {
        return appendResult.trim() || appendTemplate;
      }

      const templateLines = appendTemplate
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("|"));
      const header = templateLines[0] || "| 维度 | 内容 |";
      const separator =
        templateLines.find((line) =>
          isMarkdownSeparatorRow(parseMarkdownTableCells(line)),
        ) || "|------|------|";
      return [header, separator, ...appendRows].join("\n");
    }

    if (appendRows.length === 0) {
      return existingTable;
    }

    const existingRows = this.extractTableDataRows(existingTable);
    const existingEntrySet = new Set(
      existingRows.map((row) => this.extractRowEntryName(row)).filter(Boolean),
    );
    const rowsToInsert = appendRows.filter(
      (row) => !existingEntrySet.has(this.extractRowEntryName(row)),
    );
    if (rowsToInsert.length === 0) {
      return existingTable;
    }

    const lines = existingTable.split("\n");
    let insertPos = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith("|")) {
        insertPos = i + 1;
        break;
      }
    }
    lines.splice(insertPos, 0, ...rowsToInsert);
    return lines.join("\n");
  }

  private static extractTableDataRows(md: string): string[] {
    const lines = md
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("|"));
    if (lines.length === 0) return [];

    const dataRows: string[] = [];
    let headerDone = false;
    for (const line of lines) {
      const cells = parseMarkdownTableCells(line);
      if (!headerDone) {
        if (isMarkdownSeparatorRow(cells)) {
          headerDone = true;
        }
        continue;
      }
      if (!isMarkdownSeparatorRow(cells)) {
        dataRows.push(line);
      }
    }

    if (dataRows.length > 0) return dataRows;

    const nonSeparator = lines.filter(
      (line) => !isMarkdownSeparatorRow(parseMarkdownTableCells(line)),
    );
    if (nonSeparator.length > 1) return nonSeparator.slice(1);
    return nonSeparator.length === 1 ? nonSeparator : [];
  }

  private static extractRowEntryName(row: string): string {
    return normalizeTableEntryName(parseMarkdownTableCells(row)[0] || "");
  }

  private static splitTableHeaderAndRows(
    md: string,
  ): { header: string; dataRows: string; nonTableContent: string } {
    const lines = md.split("\n");
    const headerLines: string[] = [];
    const dataLines: string[] = [];
    const nonTableLines: string[] = [];
    let headerDone = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (!trimmed.startsWith("|")) {
        nonTableLines.push(trimmed);
        continue;
      }

      if (!headerDone) {
        headerLines.push(trimmed);
        if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
          headerDone = true;
        }
        continue;
      }

      dataLines.push(trimmed);
    }

    return {
      header: headerLines.join("\n"),
      dataRows: dataLines.join("\n"),
      nonTableContent: nonTableLines.join("\n"),
    };
  }

  private static extractAuthorSurname(item: Zotero.Item): string {
    const creators = (item as any).getCreators?.() || [];
    if (creators.length === 0) return "未知";

    const creator = creators[0];
    if (creator.lastName) return creator.lastName;
    if (creator.name) {
      const nameParts = creator.name.trim().split(/\s+/);
      return nameParts[nameParts.length - 1];
    }

    return "未知";
  }

  private static extractYear(item: Zotero.Item): string {
    const dateStr = (item.getField("date") as string) || "";
    const match = dateStr.match(/(\d{4})/);
    return match ? match[1] : "未知";
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let result = "";

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      result += String.fromCharCode.apply(null, Array.from(chunk));
    }

    return btoa(result);
  }
}

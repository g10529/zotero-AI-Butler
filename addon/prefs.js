/**
 * @file 插件的默认首选项
 * @description 此文件定义了插件首次启动或重置时的默认配置。
 * 注意：默认提示词主要在 src/utils/prompts.ts 中进行管理。
 * 此文件中的 summaryPrompt 仅作为备用值，在实际初始化时会被覆盖。
 */

// ==================== API 配置 ====================
pref("__prefsPrefix__.provider", "openai");
pref("__prefsPrefix__.openaiApiKey", "");
pref("__prefsPrefix__.openaiApiUrl", "https://api.openai.com/v1/responses");
pref("__prefsPrefix__.openaiApiModel", "gpt-3.5-turbo");
pref("__prefsPrefix__.openaiCompatApiKey", "");
pref(
  "__prefsPrefix__.openaiCompatApiUrl",
  "https://api.openai.com/v1/chat/completions",
);
pref("__prefsPrefix__.openaiCompatModel", "gpt-3.5-turbo");
pref(
  "__prefsPrefix__.geminiApiUrl",
  "https://generativelanguage.googleapis.com",
);
pref("__prefsPrefix__.geminiApiKey", "");
pref("__prefsPrefix__.geminiModel", "gemini-2.5-pro");
pref("__prefsPrefix__.anthropicApiUrl", "https://api.anthropic.com");
pref("__prefsPrefix__.anthropicApiKey", "");
pref("__prefsPrefix__.anthropicModel", "claude-3-5-sonnet-20241022");
pref(
  "__prefsPrefix__.openRouterApiUrl",
  "https://openrouter.ai/api/v1/chat/completions",
);
pref("__prefsPrefix__.openRouterApiKey", "");
pref("__prefsPrefix__.openRouterModel", "google/gemma-3-27b-it");
pref(
  "__prefsPrefix__.volcanoArkApiUrl",
  "https://ark.cn-beijing.volces.com/api/v3/responses",
);
pref("__prefsPrefix__.volcanoArkApiKey", "");
pref("__prefsPrefix__.volcanoArkModel", "doubao-seed-1-8-251228");
pref("__prefsPrefix__.temperature", "0.7");
pref("__prefsPrefix__.enableTemperature", true);
pref("__prefsPrefix__.maxTokens", "8192");
pref("__prefsPrefix__.enableMaxTokens", true);
pref("__prefsPrefix__.topP", "1.0");
pref("__prefsPrefix__.enableTopP", true);
pref("__prefsPrefix__.stream", true);
pref("__prefsPrefix__.requestTimeout", "300000"); // 5分钟超时
// MINERU API KEY
pref("__prefsPrefix__.mineruApiKey", "");
pref("__prefsPrefix__.mineruModelVersion", "vlm");

// ==================== 提示词配置 ====================
pref(
  "__prefsPrefix__.summaryPrompt",
  "# 角色\n您好，我是您的AI管家。我将为您 meticulously 地阅读这篇论文，并为您整理一份详尽的笔记。\n\n# 任务\n请为我分析下方提供的学术论文，并生成一份包含以下三个部分的综合性总结：\n\n### 第一部分：核心摘要\n请用一个段落高度概括论文的核心内容，包括研究问题、方法、关键发现和主要结论，让我能迅速掌握论文的精髓。\n\n### 第二部分：章节详解\n请识别并划分论文的主要章节（如引言、方法、结果、讨论等），并为每个章节提供一个清晰的标题和详细的内容总结。\n\n### 第三部分：创新与局限\n请根据论文内容，分析并总结其主要创新点和存在的局限性，并指出未来可能的研究方向。\n\n# 输出要求\n- 结构清晰，逻辑严谨。\n- 语言精炼，准确传达。\n- 请使用中文进行回答。",
);
pref(
  "__prefsPrefix__.autoTagList",
  "#性能/力学性能/抗压强度\n#性能/力学性能/抗折强度\n#性能/力学性能/粘结强度\n#性能/力学性能/强度发展\n#性能/工作性/流动度\n#性能/工作性/坍落度\n#性能/工作性/流变性\n#性能/工作性/经时损失\n#性能/凝结时间\n#性能/凝结时间/初凝\n#性能/凝结时间/终凝\n#性能/安定性\n#性能/安定性/膨胀率\n#性能/安定性/收缩/自收缩\n#性能/安定性/收缩/干缩\n#性能/安定性/收缩/化学收缩\n#性能/耐久性\n#性能/耐久性/抗冻性\n#性能/耐久性/抗渗性\n#性能/耐久性/抗硫酸盐侵蚀\n#性能/耐久性/抗氯盐侵蚀\n#性能/耐久性/抗碳化\n#性能/耐久性/盐冻\n#性能/防冻性\n#性能/防冻性/抗冻临界强度\n#性能/防冻性/冻胀率\n#性能/防冻性/负温强度发展\n#表征/TG-DSC\n#表征/TG-DSC/物相定量\n#表征/TG-DSC/分解温度\n#表征/XRD\n#表征/XRD/物相鉴定\n#表征/XRD/Rietveld精修\n#表征/XRD/原位XRD\n#表征/FTIR\n#表征/FTIR/官能团归属\n#表征/Raman\n#表征/Raman/物相鉴定\n#表征/NMR\n#表征/NMR/27Al-NMR\n#表征/NMR/29Si-NMR\n#表征/NMR/1H-NMR\n#表征/SEM\n#表征/SEM/形貌\n#表征/SEM/EDS\n#表征/SEM/BSE\n#表征/TEM\n#表征/TEM/形貌\n#表征/TEM/SAED\n#表征/TEM/HR-TEM\n#表征/MIP\n#表征/MIP/孔径分布\n#表征/MIP/总孔隙率\n#表征/BET\n#表征/BET/比表面积\n#表征/BET/孔径分布\n#表征/孔溶液\n#表征/孔溶液/离子浓度\n#表征/孔溶液/pH\n#表征/孔溶液/饱和指数\n#表征/IC\n#表征/ICP\n#表征/TOC\n#表征/等温量热\n#表征/等温量热/水化放热速率\n#表征/等温量热/累积放热量\n#表征/XPS\n#表征/纳米压痕\n#表征/XRF\n#表征/粒度分析",
);
pref("__prefsPrefix__.customPrompts", "[]");
// 多轮对话总结模式: "single"(单次对话) | "multi_concat"(多轮拼接) | "multi_summarize"(多轮后总结)
pref("__prefsPrefix__.summaryMode", "single");
// 多轮提示词 (JSON 数组): 每个元素包含 id、title、prompt、order
pref(
  "__prefsPrefix__.multiRoundPrompts",
  '[{"id":"round1","title":"研究背景与问题","prompt":"请详细介绍这篇论文的研究背景和动机。具体包括：1) 这个研究领域目前面临哪些主要挑战？2) 现有方法存在什么不足？3) 本文要解决的核心问题是什么？请用中文回答。","order":1},{"id":"round2","title":"研究方法与技术","prompt":"请详细解释这篇论文提出的方法和技术。具体包括：1) 核心方法/算法/框架是什么？2) 关键技术细节和创新点有哪些？3) 与现有方法相比有什么改进？请用中文回答。","order":2},{"id":"round3","title":"实验设计与结果","prompt":"请详细分析这篇论文的实验部分。具体包括：1) 使用了哪些数据集和评价指标？2) 主要的实验结果是什么？3) 与基线方法相比表现如何？4) 有哪些消融实验和分析？请用中文回答。","order":3},{"id":"round4","title":"结论与展望","prompt":"请总结这篇论文的结论和贡献。具体包括：1) 论文的主要贡献和创新点是什么？2) 存在哪些局限性？3) 未来可能的研究方向有哪些？请用中文回答。","order":4}]',
);
// 多轮对话后的最终总结提示词
pref(
  "__prefsPrefix__.multiRoundFinalPrompt",
  "基于以上多轮对话的内容，请为我生成一份完整、结构化的论文总结笔记。要求：\\n1. 开头用一段话概括论文的核心内容\\n2. 分章节整理各部分的关键信息\\n3. 突出论文的创新点和贡献\\n4. 指出论文的局限性和未来方向\\n5. 语言简洁清晰，使用中文",
);
// 多轮总结模式下是否保存中间对话内容到笔记（仅对 multi_summarize 生效）
pref("__prefsPrefix__.multiSummarySaveIntermediate", false);

// ==================== 任务队列配置 ====================
pref("__prefsPrefix__.maxRetries", "3");
pref("__prefsPrefix__.batchSize", "1");
pref("__prefsPrefix__.batchInterval", "60");
pref("__prefsPrefix__.autoScan", false);
pref("__prefsPrefix__.scanInterval", "300");
pref("__prefsPrefix__.pdfProcessMode", "base64"); // "text" 或 "base64"
pref("__prefsPrefix__.pdfAttachmentMode", "default"); // "default" 或 "all"

// ==================== 一图总结配置 ====================
pref("__prefsPrefix__.imageSummaryCustomHeaders", ""); // 额外请求 Headers，JSON/Python dict 对象字符串
pref("__prefsPrefix__.imageSummaryAspectRatioEnabled", false); // 是否发送宽高比/size 参数
pref("__prefsPrefix__.imageSummaryAspectRatio", "16:9"); // 图片宽高比，如 "1:1", "16:9", "9:16"
pref("__prefsPrefix__.imageSummaryResolutionEnabled", false); // 是否发送分辨率/size 参数
pref("__prefsPrefix__.imageSummaryResolution", "1K"); // 图片分辨率: "1K", "2K", "4K"

// ==================== UI 配置 ====================
pref("__prefsPrefix__.theme", "auto");
pref("__prefsPrefix__.fontSize", "14");
pref("__prefsPrefix__.autoScroll", true);
pref("__prefsPrefix__.windowWidth", "900");
pref("__prefsPrefix__.windowHeight", "700");
pref("__prefsPrefix__.saveChatHistory", true);
pref(
  "__prefsPrefix__.contextMenuItemVisibility",
  '{"generateSummary":true,"multiRoundReanalyze":true,"dashboard":true,"chatWithAI":true,"imageSummary":true,"mindmap":true,"fillTable":true,"literatureReview":true}',
);
pref(
  "__prefsPrefix__.contextMenuItemOrder",
  '["generateSummary","multiRoundReanalyze","dashboard","chatWithAI","imageSummary","mindmap","fillTable","literatureReview"]',
);
pref(
  "__prefsPrefix__.sidebarModuleVisibility",
  '{"actionButtons":true,"note":true,"table":true,"imageSummary":true,"mindmap":true,"quickChat":true}',
);
pref(
  "__prefsPrefix__.sidebarModuleOrder",
  '["actionButtons","note","table","imageSummary","mindmap","quickChat"]',
);
pref("__prefsPrefix__.sidebarNoteCollapsed", false);
pref("__prefsPrefix__.sidebarImageCollapsed", false);

// ==================== 数据管理 ====================
pref("__prefsPrefix__.notePrefix", "[AI-Butler]");
pref("__prefsPrefix__.noteStrategy", "skip");

// ==================== 思维导图配置 ====================
pref("__prefsPrefix__.mindmapPrompt", ""); // 空表示使用默认提示词
pref("__prefsPrefix__.mindmapExportPath", ""); // 空表示使用桌面目录

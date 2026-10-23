// 题目类型的格式，与 README.md 中的格式一致

export interface FillBlankOptions {
  n: number; // 填空题的题目数量
  m: number; // 多余/干扰单词数量
}

export interface TranslateOptions {
  n: number; // 翻译句子的题目数量
}

export interface MeaningSelectOptions {
  n?: number; // 选择题的题目数量（每个单词一道题），英译中和英英释义共用
}

export interface DefinitionFillBlankOptions {
  n: number; // 填空题的题目数量
  m: number; // 多余/干扰单词数量
}

export interface WordSelectTranslateOptions {
  n: number; // 翻译句子的题目数量
  m: number; // 多余/干扰单词数量
}

export interface WordCardOptions {
  // 单词卡片数量。不传或传入值 ≥ 所选单词数时，生成全部卡片。
  // 小于所选单词数时，从所选单词中随机（可加权）抽取 n 个生成卡片。
  n?: number;
  // 开启 AI 例句：根据熟词生义为每个释义生成一句英文例句。
  // 卡片立即生成，例句由后台逐词补全（前端渐进展示），生成后写回词库缓存。
  aiSentences?: boolean;
  // 点击查看例句：开启后卡片背面默认只显示释义，点「查看例句」才切换为例句视图，
  // 释义与例句不会同时出现（方便自测熟词生义）。仅在 aiSentences 为真时生效。
  sentencesCollapsed?: boolean;
}

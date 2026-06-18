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

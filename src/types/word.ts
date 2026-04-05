// 此文件包含词汇和标签的类型定义

export type WordTag = string;

// 关联类型
export type RelatedWordType = 'different_form' | 'easily_confused';

// 关联单词接口 - 存储单词文本而不是 ID
export interface RelatedWord {
  text: string;         // 关联单词的文本
  type: RelatedWordType; // 关联类型
}

export interface Word {
  id: number;
  text: string;
  tags: WordTag[];
  meanings?: {
    content: string;
    type: string;
    sentence: string;
  }[];
  relatedWords?: RelatedWord[];  // 关联单词
}

// 颜色配置接口
export interface ColorConfig {
  id: string;
  name: string;
  className: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

// 标签配置接口
export interface TagConfig {
  id: string;
  name: string;
  colorId: string;
  description: string;
}

// AI 出题相关类型
export type QuestionStatus = 'GENERATING' | 'GENERATED' | 'ANSWERED';
export type QuestionType = 'fill-blank' | 'translate';

export interface QuestionQueueItem {
  id: string;
  questionType: QuestionType;
  status: QuestionStatus;
  questionContent?: Record<string, unknown>;
  lastAnswer?: Record<string, unknown>;
  wordIds: number[];
  createdAt: string;
  updatedAt: string;
}
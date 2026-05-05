// 此文件包含词汇和标签的类型定义

import { Meaning } from './dict';

export type WordTag = string;

export type WordData = {
  id: number;
  text: string;
  meanings: Meaning[];  // 用户不熟悉的释义列表
};

export type RelatedWordType = 'different_form' | 'easily_confused';

export interface RelatedWord {
  text: string;         // 关联单词的文本
  type: RelatedWordType; // 关联类型
}

export interface Word {
  id: number;
  text: string;
  tags: WordTag[];
  meanings: Meaning[];  // 用户不熟悉的释义列表
  relatedWords: RelatedWord[];  // 关联单词
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
export type QuestionStatus = 'GENERATING' | 'GENERATED' | 'GRADING' | 'ANSWERED' | 'FAILED' | 'GRADING_FAILED';
export type QuestionType =
'fill-blank' | // 选词填空
'translate' | // 翻译句子
'meaning-select' | // 英译中（选释义）
'meaning-select-en'; // 英英释义（选英文释义）


export interface QuestionQueueItem {
  id: string;
  questionType: QuestionType;
  status: QuestionStatus;
  questionContent?: Record<string, unknown>;
  lastAnswer?: Record<string, unknown>;
  wordIds: number[];
  relatedWordEntries?: object[];
  createdAt: string;
  updatedAt: string;
}
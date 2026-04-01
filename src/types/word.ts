// 此文件包含词汇和标签的类型定义

export type WordTag = string;

export interface Word {
  id: number;
  text: string;
  tags: WordTag[];
  meanings?: {
    content: string;
    type: string;
    sentence: string;
  }[];
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
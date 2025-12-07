// 此文件包含词汇和标签的类型定义

export type WordTag = "COMMON" | "MULTIPLE" | "FORMS";

export interface Word {
  id: number;
  text: string;
  tags: WordTag[];
}

export interface TagConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}
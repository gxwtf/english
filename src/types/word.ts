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

// 图标配置接口
export interface IconConfig {
  id: string;
  symbol: string;
  lucideName?: string; // 可选的 lucide-react 组件名称
  displayName: string;
}

// 标签配置接口 - 现在图标和颜色是独立的
export interface TagConfig {
  id: string;
  name: string;
  iconId: string;
  colorId: string;
  description: string;
}

// 获取图标符号的辅助类型
export type IconSymbol = string;
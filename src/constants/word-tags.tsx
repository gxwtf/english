// constants/word-tags.ts
import { TagConfig, WordTag, ColorConfig } from '@/types/word';

export const WORD_TAGS: Record<WordTag, TagConfig> = {};

// 预设颜色配置
export const COLOR_PRESETS: ColorConfig[] = [
  {
    id: 'blue',
    name: '蓝色',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200'
  },
  {
    id: 'purple',
    name: '紫色',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-700',
    borderClass: 'border-purple-200'
  },
  {
    id: 'amber',
    name: '琥珀色',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200'
  },
  {
    id: 'green',
    name: '绿色',
    className: 'bg-green-50 text-green-700 border-green-200',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
    borderClass: 'border-green-200'
  },
  {
    id: 'red',
    name: '红色',
    className: 'bg-red-50 text-red-700 border-red-200',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    borderClass: 'border-red-200'
  },
  {
    id: 'indigo',
    name: '靛蓝色',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
    borderClass: 'border-indigo-200'
  },
  {
    id: 'pink',
    name: '粉色',
    className: 'bg-pink-50 text-pink-700 border-pink-200',
    bgClass: 'bg-pink-50',
    textClass: 'text-pink-700',
    borderClass: 'border-pink-200'
  },
  {
    id: 'yellow',
    name: '黄色',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    bgClass: 'bg-yellow-50',
    textClass: 'text-yellow-700',
    borderClass: 'border-yellow-200'
  },
  {
    id: 'teal',
    name: '青色',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    borderClass: 'border-teal-200'
  },
  {
    id: 'orange',
    name: '橙色',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-200'
  },
  {
    id: 'cyan',
    name: '青绿色',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    bgClass: 'bg-cyan-50',
    textClass: 'text-cyan-700',
    borderClass: 'border-cyan-200'
  },
  {
    id: 'lime',
    name: '酸橙色',
    className: 'bg-lime-50 text-lime-700 border-lime-200',
    bgClass: 'bg-lime-50',
    textClass: 'text-lime-700',
    borderClass: 'border-lime-200'
  },
  {
    id: 'lightblue',
    name: '浅蓝色',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    borderClass: 'border-blue-300'
  }
];
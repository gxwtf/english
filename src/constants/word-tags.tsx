// constants/word-tags.ts
import { TagConfig, WordTag, ColorConfig } from '@/types/word';

// 初始标签配置为空，由 storage 自动从 localStorage 加载
export const WORD_TAGS: Record<WordTag, TagConfig> = {};

// 预设颜色配置
// 说明：色值不写在这里，而是下沉到 globals.css 的 --tag-<id>-bg/fg/bd 变量，
// 浅色与深色各一套（docs/dark-mode.md §5）。这样：
//   ① 绕过全站品牌色重映射（blue -> 实验红），标签色保持用户预期；
//   ② 深色模式自动换成「深底 + 亮字 + 同色系边框」，不用在每个组件里补 dark:；
//   ③ 用户已存的数据只记 colorId，无需迁移。
export const COLOR_PRESETS: ColorConfig[] = [
  {
    id: 'blue',
    name: '蓝色',
    className: 'bg-tag-blue-bg text-tag-blue-fg border-tag-blue-bd',
    bgClass: 'bg-tag-blue-bg',
    textClass: 'text-tag-blue-fg',
    borderClass: 'border-tag-blue-bd'
  },
  {
    id: 'purple',
    name: '紫色',
    className: 'bg-tag-purple-bg text-tag-purple-fg border-tag-purple-bd',
    bgClass: 'bg-tag-purple-bg',
    textClass: 'text-tag-purple-fg',
    borderClass: 'border-tag-purple-bd'
  },
  {
    id: 'amber',
    name: '琥珀色',
    className: 'bg-tag-amber-bg text-tag-amber-fg border-tag-amber-bd',
    bgClass: 'bg-tag-amber-bg',
    textClass: 'text-tag-amber-fg',
    borderClass: 'border-tag-amber-bd'
  },
  {
    id: 'green',
    name: '绿色',
    className: 'bg-tag-green-bg text-tag-green-fg border-tag-green-bd',
    bgClass: 'bg-tag-green-bg',
    textClass: 'text-tag-green-fg',
    borderClass: 'border-tag-green-bd'
  },
  {
    id: 'red',
    name: '红色',
    className: 'bg-tag-red-bg text-tag-red-fg border-tag-red-bd',
    bgClass: 'bg-tag-red-bg',
    textClass: 'text-tag-red-fg',
    borderClass: 'border-tag-red-bd'
  },
  {
    id: 'indigo',
    name: '靛蓝色',
    className: 'bg-tag-indigo-bg text-tag-indigo-fg border-tag-indigo-bd',
    bgClass: 'bg-tag-indigo-bg',
    textClass: 'text-tag-indigo-fg',
    borderClass: 'border-tag-indigo-bd'
  },
  {
    id: 'pink',
    name: '粉色',
    className: 'bg-tag-pink-bg text-tag-pink-fg border-tag-pink-bd',
    bgClass: 'bg-tag-pink-bg',
    textClass: 'text-tag-pink-fg',
    borderClass: 'border-tag-pink-bd'
  },
  {
    id: 'yellow',
    name: '黄色',
    className: 'bg-tag-yellow-bg text-tag-yellow-fg border-tag-yellow-bd',
    bgClass: 'bg-tag-yellow-bg',
    textClass: 'text-tag-yellow-fg',
    borderClass: 'border-tag-yellow-bd'
  },
  {
    id: 'teal',
    name: '青色',
    className: 'bg-tag-teal-bg text-tag-teal-fg border-tag-teal-bd',
    bgClass: 'bg-tag-teal-bg',
    textClass: 'text-tag-teal-fg',
    borderClass: 'border-tag-teal-bd'
  },
  {
    id: 'orange',
    name: '橙色',
    className: 'bg-tag-orange-bg text-tag-orange-fg border-tag-orange-bd',
    bgClass: 'bg-tag-orange-bg',
    textClass: 'text-tag-orange-fg',
    borderClass: 'border-tag-orange-bd'
  },
  {
    id: 'cyan',
    name: '青绿色',
    className: 'bg-tag-cyan-bg text-tag-cyan-fg border-tag-cyan-bd',
    bgClass: 'bg-tag-cyan-bg',
    textClass: 'text-tag-cyan-fg',
    borderClass: 'border-tag-cyan-bd'
  },
  {
    id: 'lime',
    name: '酸橙色',
    className: 'bg-tag-lime-bg text-tag-lime-fg border-tag-lime-bd',
    bgClass: 'bg-tag-lime-bg',
    textClass: 'text-tag-lime-fg',
    borderClass: 'border-tag-lime-bd'
  },
  {
    id: 'lightblue',
    name: '浅蓝色',
    className: 'bg-tag-lightblue-bg text-tag-lightblue-fg border-tag-lightblue-bd',
    bgClass: 'bg-tag-lightblue-bg',
    textClass: 'text-tag-lightblue-fg',
    borderClass: 'border-tag-lightblue-bd'
  }
];

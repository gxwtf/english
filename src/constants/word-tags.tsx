// constants/word-tags.ts
import { TagConfig, WordTag, ColorConfig } from '@/types/word';

// 初始标签配置为空，由 storage 自动从 localStorage 加载
export const WORD_TAGS: Record<WordTag, TagConfig> = {};

// 预设颜色配置
// 说明：这里使用显式色值（arbitrary values），不依赖 Tailwind 调色板，
// 避免全站品牌色重映射（blue -> 实验红）影响用户自定义标签颜色。
export const COLOR_PRESETS: ColorConfig[] = [
  {
    id: 'blue',
    name: '蓝色',
    className: 'bg-[#eff6ff] text-[#1447e6] border-[#bedbff]',
    bgClass: 'bg-[#eff6ff]',
    textClass: 'text-[#1447e6]',
    borderClass: 'border-[#bedbff]'
  },
  {
    id: 'purple',
    name: '紫色',
    className: 'bg-[#faf5ff] text-[#8200db] border-[#e9d4ff]',
    bgClass: 'bg-[#faf5ff]',
    textClass: 'text-[#8200db]',
    borderClass: 'border-[#e9d4ff]'
  },
  {
    id: 'amber',
    name: '琥珀色',
    className: 'bg-[#fffbeb] text-[#bb4d00] border-[#fee685]',
    bgClass: 'bg-[#fffbeb]',
    textClass: 'text-[#bb4d00]',
    borderClass: 'border-[#fee685]'
  },
  {
    id: 'green',
    name: '绿色',
    className: 'bg-[#f0fdf4] text-[#008236] border-[#b9f8cf]',
    bgClass: 'bg-[#f0fdf4]',
    textClass: 'text-[#008236]',
    borderClass: 'border-[#b9f8cf]'
  },
  {
    id: 'red',
    name: '红色',
    className: 'bg-[#fef2f2] text-[#c10007] border-[#ffc9c9]',
    bgClass: 'bg-[#fef2f2]',
    textClass: 'text-[#c10007]',
    borderClass: 'border-[#ffc9c9]'
  },
  {
    id: 'indigo',
    name: '靛蓝色',
    className: 'bg-[#eef2ff] text-[#432dd7] border-[#c6d2ff]',
    bgClass: 'bg-[#eef2ff]',
    textClass: 'text-[#432dd7]',
    borderClass: 'border-[#c6d2ff]'
  },
  {
    id: 'pink',
    name: '粉色',
    className: 'bg-[#fdf2f8] text-[#c6005c] border-[#fccee8]',
    bgClass: 'bg-[#fdf2f8]',
    textClass: 'text-[#c6005c]',
    borderClass: 'border-[#fccee8]'
  },
  {
    id: 'yellow',
    name: '黄色',
    className: 'bg-[#fefce8] text-[#a65f00] border-[#fff085]',
    bgClass: 'bg-[#fefce8]',
    textClass: 'text-[#a65f00]',
    borderClass: 'border-[#fff085]'
  },
  {
    id: 'teal',
    name: '青色',
    className: 'bg-[#f0fdfa] text-[#00786f] border-[#96f7e4]',
    bgClass: 'bg-[#f0fdfa]',
    textClass: 'text-[#00786f]',
    borderClass: 'border-[#96f7e4]'
  },
  {
    id: 'orange',
    name: '橙色',
    className: 'bg-[#fff7ed] text-[#ca3500] border-[#ffd6a7]',
    bgClass: 'bg-[#fff7ed]',
    textClass: 'text-[#ca3500]',
    borderClass: 'border-[#ffd6a7]'
  },
  {
    id: 'cyan',
    name: '青绿色',
    className: 'bg-[#ecfeff] text-[#007595] border-[#a2f4fd]',
    bgClass: 'bg-[#ecfeff]',
    textClass: 'text-[#007595]',
    borderClass: 'border-[#a2f4fd]'
  },
  {
    id: 'lime',
    name: '酸橙色',
    className: 'bg-[#f7fee7] text-[#497d00] border-[#d8f999]',
    bgClass: 'bg-[#f7fee7]',
    textClass: 'text-[#497d00]',
    borderClass: 'border-[#d8f999]'
  },
  {
    id: 'lightblue',
    name: '浅蓝色',
    className: 'bg-[#dbeafe] text-[#193cb8] border-[#8ec5ff]',
    bgClass: 'bg-[#dbeafe]',
    textClass: 'text-[#193cb8]',
    borderClass: 'border-[#8ec5ff]'
  }
];

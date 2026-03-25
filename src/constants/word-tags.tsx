// constants/word-tags.ts
import { TagConfig, WordTag, ColorConfig, IconConfig } from '@/types/word';

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
  }
];

// 图标配置
export const ICON_PRESETS: IconConfig[] = [
  // 基础几何图形 - 使用 lucide-react
  { id: 'circle', symbol: '○', lucideName: 'Circle', displayName: '圆圈' },
  { id: 'dot', symbol: '●', lucideName: 'CircleDot', displayName: '实心圆' },
  { id: 'square', symbol: '■', lucideName: 'Square', displayName: '方形' },
  { id: 'triangle', symbol: '▲', lucideName: 'Triangle', displayName: '三角形' },
  { id: 'diamond', symbol: '◆', lucideName: 'Diamond', displayName: '菱形' },
  { id: 'star', symbol: '★', lucideName: 'Star', displayName: '星形' },
  { id: 'heart', symbol: '♥', lucideName: 'Heart', displayName: '心形' },

  // 特殊符号（暂时保持字符）
  { id: 'diamond-solid', symbol: '♦', displayName: '实心菱形' },
  { id: 'spade', symbol: '♠', displayName: '黑桃' },
  { id: 'club', symbol: '♣', displayName: '梅花' },

  // 星形变体
  { id: 'star-four', symbol: '✦', displayName: '四角星' },
  { id: 'star-eight', symbol: '✧', displayName: '八角星' },
  { id: 'star-circle', symbol: '✪', displayName: '星圈' },
  { id: 'star-dash', symbol: '✫', displayName: '星号线' },
  { id: 'star-two', symbol: '✬', displayName: '双星' },
  { id: 'star-plus', symbol: '✭', displayName: '星号' },
  { id: 'star-cross', symbol: '✮', displayName: '星叉' },
  { id: 'star-burst', symbol: '✯', displayName: '星爆' },

  // 闪光系列
  { id: 'sparkle', symbol: '✰', lucideName: 'Sparkles', displayName: '闪光' },
  { id: 'sparkle-small', symbol: '✱', displayName: '小闪光' },
  { id: 'sparkle-medium', symbol: '✲', displayName: '中闪光' },
  { id: 'sparkle-large', symbol: '✳', displayName: '大闪光' },
  { id: 'sparkle-diamond', symbol: '✴', displayName: '钻闪光' },
  { id: 'sparkle-bullet', symbol: '✵', displayName: '点闪光' },
  { id: 'sparkle-pin', symbol: '✶', displayName: '针闪光' },
  { id: 'sparkle-needle', symbol: '✷', displayName: '针尖闪光' },
  { id: 'sparkle-heavy', symbol: '✸', displayName: '重闪光' },
  { id: 'sparkle-intense', symbol: '✹', displayName: '强闪光' },
  { id: 'sparkle-sharp', symbol: '✺', displayName: '锐闪光' },
  { id: 'sparkle-wing', symbol: '✻', displayName: '翼闪光' },
  { id: 'sparkle-feather', symbol: '✼', displayName: '羽闪光' },
  { id: 'sparkle-needle-tip', symbol: '✽', displayName: '针尖闪光' },
  { id: 'sparkle-intense-tip', symbol: '✾', displayName: '强尖闪光' },
  { id: 'sparkle-flower', symbol: '✿', displayName: '花闪光' }
];

// 为了向后兼容，保留原有的图标符号列表
export const ICON_OPTIONS = ICON_PRESETS.map(icon => icon.symbol);
'use client';

import { LucideIcon } from 'lucide-react';
import { ICON_PRESETS } from '@/constants/word-tags';
import type { IconConfig } from '@/types/word';

interface IconBadgeProps {
  iconId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'solid';
}

const sizeMap = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

// 导入常用的 lucide-react 图标
import {
  Circle,
  CircleDot,
  Star,
  Square,
  Triangle,
  Diamond,
  Heart,
  Zap,
  Sparkles,
  CircleDot as FilledCircle,
  Star as FilledStar,
  Square as FilledSquare,
  Triangle as FilledTriangle,
  Diamond as FilledDiamond,
  // 更多图标可以按需添加
} from 'lucide-react';

// 图标到组件的映射
const iconComponents: Record<string, LucideIcon> = {
  circle: Circle,
  dot: CircleDot,
  star: Star,
  square: Square,
  triangle: Triangle,
  diamond: Diamond,
  heart: Heart,
  sparkles: Sparkles,
  // 可以添加更多映射
};

// 获取图标组件的函数
const getIconComponent = (iconId: string): string | LucideIcon => {
  const iconConfig = ICON_PRESETS.find(i => i.id === iconId);
  if (!iconConfig) {
    // 如果找不到配置，返回一个默认的圆点
    return '●';
  }

  // 如果配置中有 lucideName，尝试使用它
  if (iconConfig.lucideName) {
    const lucideIcon = iconComponents[iconConfig.lucideName];
    if (lucideIcon) {
      return lucideIcon;
    }
  }

  // 否则回退到符号
  return iconConfig.symbol;
};

export const IconBadge = ({ iconId, className = '', size = 'md', variant = 'default' }: IconBadgeProps) => {
  const IconComponent = getIconComponent(iconId);

  const baseClasses = sizeMap[size];
  const variantClasses = variant === 'solid' ? 'fill-current' : '';

  if (typeof IconComponent === 'string') {
    // 如果是字符
    return (
      <span className={`${baseClasses} ${variantClasses} ${className}`} style={{ lineHeight: 1 }}>
        {IconComponent}
      </span>
    );
  } else {
    // 如果是 lucide-react 组件
    return (
      <IconComponent className={`${baseClasses} ${variantClasses} ${className}`} />
    );
  }
};

// 用于在文本前显示图标的组件
export const IconWithText = ({ iconId, text, className = '', size = 'md', iconClassName = '' }: {
  iconId: string;
  text: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  iconClassName?: string;
}) => {
  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <IconBadge iconId={iconId} size={size} className={iconClassName} />
      <span>{text}</span>
    </div>
  );
};
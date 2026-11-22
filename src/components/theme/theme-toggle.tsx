'use client';

/**
 * 主题切换下拉（三档：浅色 / 深色 / 跟随系统）
 *
 * 放在 Navbar 右侧：移动端只显示图标（不挤占导航空间），桌面端同样保持 icon-only，
 * 与导航里其它入口的视觉重量一致。设置页另有一个带说明文字的入口
 * （theme-settings-dialog.tsx），两处共用同一份状态。
 */

import { Check, Monitor, Moon, Sun } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { useTheme } from './theme-provider';
import type { ThemeMode } from './theme-script';

const MODE_LABEL: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
};

/** Navbar 里的触发按钮：与导航链接同一套 hover/暗色口径 */
const TRIGGER_CLASS =
  'flex items-center justify-center p-2 rounded-md transition-colors shrink-0 ' +
  'text-gray-600 hover:text-gray-900 hover:bg-gray-100 ' +
  'dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme, mounted } = useTheme();

  // 水合守卫：服务端不知道用户主题，先渲染中性图标占位，避免闪烁与水合不一致
  if (!mounted) {
    return (
      <button type="button" className={cn(TRIGGER_CLASS, className)} aria-label="切换主题" disabled>
        <Monitor className="h-4 w-4 opacity-50" />
      </button>
    );
  }

  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(TRIGGER_CLASS, className)} aria-label={`切换主题（当前：${MODE_LABEL[theme]}）`}>
          <Icon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">外观</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => {
          const ModeIcon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
          const active = theme === mode;
          return (
            <DropdownMenuItem key={mode} onClick={() => setTheme(mode)} className="gap-2">
              <ModeIcon className="h-4 w-4" />
              <span className="flex-1">{MODE_LABEL[mode]}</span>
              {active ? <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

'use client';

/**
 * 「外观」设置弹窗（设置页入口）
 *
 * 与 Navbar 的 ThemeToggle 共用同一份主题状态，区别是这里**带说明文字**：
 * 用户第一次找深色模式大多去设置页，光有图标不够，必须让他看懂「跟随系统」是什么意思。
 */

import { Check, Monitor, Moon, Sun } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useTheme } from './theme-provider';
import type { ThemeMode } from './theme-script';

const OPTIONS: { mode: ThemeMode; label: string; hint: string; icon: typeof Sun }[] = [
  { mode: 'light', label: '浅色', hint: '始终使用明亮界面', icon: Sun },
  { mode: 'dark', label: '深色', hint: '始终使用暗色界面，夜里看不刺眼', icon: Moon },
  { mode: 'system', label: '跟随系统', hint: '随手机的深色模式自动切换（默认）', icon: Monitor },
];

export function ThemeSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { theme, setTheme, mounted } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>外观</DialogTitle>
          <DialogDescription>选择界面配色。默认跟随系统，手机开启深色模式时会自动变暗。</DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {OPTIONS.map(({ mode, label, hint, icon: Icon }) => {
            const active = mounted && theme === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setTheme(mode)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  active
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    active
                      ? 'bg-blue-600 text-white dark:bg-blue-500'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" /> : null}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

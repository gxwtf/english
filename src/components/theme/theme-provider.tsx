'use client';

/**
 * 主题 Provider（零依赖，替代 next-themes）
 *
 * 口径（docs/dark-mode.md §4）：
 *   - 默认 system：首訪跟随 prefers-color-scheme，**系统切换时实时跟随**
 *   - 三档 light / dark / system，持久化到 localStorage['gx-theme']
 *   - .dark 挂在 <html>（Tailwind 的 @custom-variant dark (&:is(.dark *)) 只认它）
 *   - 同步 <html style="color-scheme"> 与 <meta name="theme-color">
 *   - 切换瞬间给 <html> 加 .theme-switching，80ms 后移除，压掉整页颜色渐变的廉价感
 *   - 跨标签页同步：监听 storage 事件
 *
 * 首帧不闪：layout.tsx 的 <head> 里内联了 themeInitScript（同口径），
 * 本 Provider 只负责挂载后的状态与用户交互。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  DARK_QUERY,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeMode,
} from './theme-script';

interface ThemeContextValue {
  /** 用户选择的档位（light / dark / system） */
  theme: ThemeMode;
  /** 实际生效的模式；服务端渲染尚未挂载时为 null */
  resolvedTheme: ResolvedTheme | null;
  setTheme: (mode: ThemeMode) => void;
  /** 是否已完成客户端挂载（下拉/弹窗用它做守卫，避免水合不一致） */
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** 读取系统偏好（SSR 环境返回 false，交给内联脚本处理首帧） */
function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(DARK_QUERY).matches;
}

function readStoredTheme(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // localStorage 不可用（隐私模式 / 禁用存储）时静默回落
  }
  return 'system';
}

/** 把解析结果写进 DOM：.dark 类、color-scheme、theme-color meta */
function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  const isDark = resolved === 'dark';
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = resolved;

  const color = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 服务端与首帧客户端都按 system 渲染，挂载后再对齐 localStorage（避免水合不一致）
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [mounted, setMounted] = useState(false);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
    return theme;
  }, [theme]);

  // 挂载后：读持久化值并应用
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    setMounted(true);
  }, []);

  // 主题变化 → 应用到 DOM（含切换瞬间压制过渡）
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.add('theme-switching');
    applyResolvedTheme(resolvedTheme);
    const timer = window.setTimeout(() => root.classList.remove('theme-switching'), 80);
    return () => window.clearTimeout(timer);
  }, [resolvedTheme, mounted]);

  // 跟随系统：系统切换时实时生效
  useEffect(() => {
    if (!mounted || !window.matchMedia) return;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      if (readStoredTheme() === 'system') {
        const root = document.documentElement;
        root.classList.add('theme-switching');
        applyResolvedTheme(mql.matches ? 'dark' : 'light');
        window.setTimeout(() => root.classList.remove('theme-switching'), 80);
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mounted]);

  // 跨标签页同步
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next: ThemeMode =
        event.newValue === 'light' || event.newValue === 'dark' || event.newValue === 'system'
          ? event.newValue
          : 'system';
      setThemeState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // 存不了就只是本次会话内生效，不影响使用
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme: mounted ? resolvedTheme : null, setTheme, mounted }),
    [theme, resolvedTheme, setTheme, mounted],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 读取主题状态；不在 Provider 内使用时返回安全默认值（不抛错） */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    theme: 'system',
    resolvedTheme: null,
    setTheme: () => {},
    mounted: false,
  };
}

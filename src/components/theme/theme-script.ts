/**
 * 主题（浅色 / 深色 / 跟随系统）—— 无闪烁初始化脚本与常量
 *
 * 为什么不用 next-themes：本站用自定义 `scripts/dev.mjs` 启停，服务器上 `pnpm install`
 * 受供应链策略约束，新增依赖要动 pnpm-lock.yaml，部署风险大于收益（方案见 docs/dark-mode.md §4）。
 * 这里用一段内联脚本在首帧前把 .dark 类定妥，效果与 next-themes 的注入脚本等价。
 *
 * 本文件是**常量与被内联的脚本字符串**，两端（Server Component 的 <head> 内联、
 * Client 的 ThemeProvider）共用同一份口径，避免两处逻辑漂移。
 */

/** localStorage 键：两个站点同名，跨站体验一致 */
export const THEME_STORAGE_KEY = 'gx-theme';

/** 合法值：跟随系统 / 强制浅色 / 强制深色 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'] as const;

/** 系统深色偏好媒体查询 */
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * 浏览器 UI（地址栏 / 状态栏）颜色，与 globals.css 的 --background 保持一致：
 * 吸顶导航与状态栏同色才不会割裂，所以不用品牌红。
 */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#ffffff',
  dark: '#14100f',
} as const;

/**
 * 首帧前执行的内联脚本（放在 <head> 里，早于任何可见内容）。
 * - 读 localStorage 决定 light / dark / system
 * - 给 <html> 加 .dark、设置 color-scheme
 * - 同步 <meta name="theme-color">
 * 出错一律静默回落到「跟随系统」，绝不影响页面渲染。
 */
export const themeInitScript = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)},q=${JSON.stringify(DARK_QUERY)};
var m=null;try{m=localStorage.getItem(k)}catch(e){}
if(m!=='light'&&m!=='dark')m='system';
var d=m==='dark'||(m==='system'&&window.matchMedia(q).matches);
var r=document.documentElement;
r.classList.toggle('dark',d);
r.style.colorScheme=d?'dark':'light';
var c=d?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)};
var t=document.querySelector('meta[name="theme-color"]');
if(t){t.setAttribute('content',c)}else{var n=document.createElement('meta');n.setAttribute('name','theme-color');n.setAttribute('content',c);document.head.appendChild(n)}
}catch(e){}})();`;

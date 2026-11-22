'use client';

/**
 * 百度统计（hm.js）—— 水合后再加载
 *
 * 原来是在根布局的 <head> 里内联一段 `document.getElementsByTagName("script")[0]` +
 * `insertBefore(hm, s)`。问题：这段内联脚本在**解析期**就往 head 里插了一个 React 没渲染过的
 * <script src="https://hm.baidu.com/hm.js?...">，位置正好落在 React 水合的目标区间里，
 * 于是 dev 控制台一直报 "A tree hydrated but some attributes ... didn't match"。
 * 深色模式的首帧脚本让 head 里的 script 顺序改变后，这个冲突从"偶发"变成了"必然"。
 *
 * 改成客户端组件：SSR 不渲染任何东西（不会进 React 的 DOM diff），
 * mount 之后再 append 到 head 末尾。统计照常工作，只是首屏后几百毫秒才开始上报。
 */

import { useEffect } from 'react';

declare global {
  interface Window {
    _hmt?: unknown[];
  }
}

export function BaiduAnalytics({ siteId }: { siteId: string }) {
  useEffect(() => {
    if (!siteId) return;
    // 只注入一次（客户端路由切换不会重复挂载，但热更新 / 严格模式下可能跑两遍）
    if (document.getElementById('baidu-tongji')) return;

    window._hmt = window._hmt || [];
    const hm = document.createElement('script');
    hm.id = 'baidu-tongji';
    hm.async = true;
    hm.src = `https://hm.baidu.com/hm.js?${siteId}`;
    document.head.appendChild(hm);
  }, [siteId]);

  return null;
}

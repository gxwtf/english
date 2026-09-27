'use client';

import { useEffect, useState } from 'react';
import { Share, X, PlusSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getReviewStats } from '@/actions/review';

const A2HS_DISMISS_KEY = 'gxwtf-a2hs-dismissed';
const BADGE_REFRESH_MS = 5 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Android/.test(ua);
}

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function WebAppManager() {
  const { isLoggedIn } = useAuth();
  const [showIosHint, setShowIosHint] = useState(false);

  // 注册 Service Worker（仅生产环境，避免开发环境缓存 HMR 资源）
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service Worker 注册失败:', err);
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  // iOS Safari（非 standalone）引导「添加到主屏幕」
  useEffect(() => {
    if (isStandalone() || !isIos() || !isSafari()) return;
    try {
      if (localStorage.getItem(A2HS_DISMISS_KEY) === 'true') return;
    } catch {
      // 读取失败时仍然展示提示
    }
    setShowIosHint(true);
  }, []);

  const dismissIosHint = () => {
    setShowIosHint(false);
    try {
      localStorage.setItem(A2HS_DISMISS_KEY, 'true');
    } catch {
      // 忽略写入失败
    }
  };

  // App 图标角标：显示待复习数量（iOS 16.4+ / Android 支持）
  useEffect(() => {
    const nav = navigator as NavigatorWithBadge;
    if (!nav.setAppBadge) return;
    let cancelled = false;

    const updateBadge = async () => {
      if (!isLoggedIn) {
        nav.clearAppBadge?.().catch(() => {});
        return;
      }
      try {
        const stats = await getReviewStats();
        if (cancelled) return;
        const due = stats?.due ?? 0;
        if (due > 0) nav.setAppBadge?.(due).catch(() => {});
        else nav.clearAppBadge?.().catch(() => {});
      } catch {
        // 离线或未登录时静默失败
      }
    };

    updateBadge();
    const timer = window.setInterval(updateBadge, BADGE_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') updateBadge();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isLoggedIn]);

  if (!showIosHint) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
        paddingLeft: 'calc(env(safe-area-inset-left) + 0.75rem)',
        paddingRight: 'calc(env(safe-area-inset-right) + 0.75rem)',
      }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-start gap-3 rounded-xl bg-gray-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
        <PlusSquare className="mt-0.5 h-5 w-5 shrink-0 text-white" />
        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          <p className="font-semibold">安装「广学英语」到主屏幕</p>
          <p className="mt-0.5 text-white/80">
            点击底部
            <Share className="mx-1 inline h-4 w-4 align-text-bottom" />
            分享按钮，选择「添加到主屏幕」，即可全屏使用并支持离线复习。
          </p>
        </div>
        <button
          onClick={dismissIosHint}
          aria-label="不再提示"
          className="-mr-1 rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

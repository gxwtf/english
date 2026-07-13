'use client';

const COOKIE_PREFIX = 'ai-question-';

export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_PREFIX}${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : undefined;
}

export function setCookie(name: string, value: string, maxAgeDays = 365): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_PREFIX}${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeDays * 86400}; SameSite=Lax`;
}

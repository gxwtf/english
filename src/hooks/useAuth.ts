'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'gxwtf_english_auth';

// 用户信息类型
export interface UserInfo {
  userId: number;
  userName: string;
  admin: number;
  email?: string;
  realName?: string;
}

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查登录状态
  const checkAuth = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      const response = await fetch('/api/auth/verify');
      const data = await response.json();

      if (data.loggedIn) {
        setIsLoggedIn(true);
        setUserInfo({
          userId: data.userId,
          userName: data.userName,
          admin: data.admin,
        });
        // 存储到 localStorage 用于客户端状态持久化
        localStorage.setItem(STORAGE_KEY, 'true');
      } else {
        setIsLoggedIn(false);
        setUserInfo(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('Auth check failed:', e);
      // 如果 API 不可用，回退到 localStorage
      const stored = localStorage.getItem(STORAGE_KEY) === 'true';
      setIsLoggedIn(stored);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    // 初始化时检查登录状态
    checkAuth();
  }, [checkAuth]);

  const login = () => {
    // 真实登录需要跳转到 SSO
    window.location.href = '/api/auth/login';
  };

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/verify', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setIsLoggedIn(false);
      setUserInfo(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    isLoggedIn,
    isClient,
    isLoading,
    userInfo,
    login,
    logout,
    refreshAuth: checkAuth,
  };
};

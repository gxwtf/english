'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  verifyAuth as verifyAuthAction,
  logout as logoutAction,
  UserInfo,
} from '@/actions/auth';

const STORAGE_KEY = 'gxwtf_english_auth';
const USER_KEY = 'gxwtf_english_user';

interface AuthContextValue {
  isLoggedIn: boolean;
  isClient: boolean;
  isLoading: boolean;
  userInfo: UserInfo | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      const data = await verifyAuthAction();

      if (data.loggedIn) {
        const info: UserInfo = {
          userId: (data as any).userId,
          userName: (data as any).userName,
          admin: (data as any).admin,
          email: (data as any).email,
          realName: (data as any).realName,
        };
        setIsLoggedIn(true);
        setUserInfo(info);
        try {
          localStorage.setItem(STORAGE_KEY, 'true');
          localStorage.setItem(USER_KEY, JSON.stringify(info));
        } catch {}
      } else {
        setIsLoggedIn(false);
        setUserInfo(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(USER_KEY);
        } catch {}
      }
    } catch (e) {
      console.error('Auth check failed:', e);
      // 如果服务不可用，回退到 localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY) === 'true';
        setIsLoggedIn(stored);
        const cachedUser = localStorage.getItem(USER_KEY);
        setUserInfo(stored && cachedUser ? JSON.parse(cachedUser) : null);
      } catch {
        setIsLoggedIn(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    // 先用本地缓存快速恢复登录态，避免首屏/切换页面时闪现未登录
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') {
        setIsLoggedIn(true);
        const cachedUser = localStorage.getItem(USER_KEY);
        if (cachedUser) setUserInfo(JSON.parse(cachedUser));
      }
    } catch {}
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(() => {
    // 真实登录需要跳转到 SSO
    router.push('/api/auth/login');
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await logoutAction();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setIsLoggedIn(false);
      setUserInfo(null);
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(USER_KEY);
      } catch {}
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoggedIn,
      isClient,
      isLoading,
      userInfo,
      login,
      logout,
      refreshAuth: checkAuth,
    }),
    [isLoggedIn, isClient, isLoading, userInfo, login, logout, checkAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return context;
};

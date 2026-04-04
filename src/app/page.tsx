'use client';

import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';

// 导入 Server Action
import query from '@/actions/query';

export default function Home() {
  const { isLoggedIn, isClient, isLoading } = useAuth();

  // 如果尚未完成客户端初始化或正在加载认证状态，显示加载状态
  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 根据登录状态渲染不同的页面
  return isLoggedIn
    ? <AuthenticatedPage queryWord={query} />
    : <UnauthenticatedPage />;
}

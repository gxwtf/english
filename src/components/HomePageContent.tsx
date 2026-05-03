'use client';

import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import query from '@/actions/query';

export function HomePageContent() {
  const { isLoggedIn, isClient, isLoading } = useAuth();

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

  return isLoggedIn
    ? <AuthenticatedPage queryWord={query} />
    : <UnauthenticatedPage />;
}

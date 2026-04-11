'use client';

import Link from 'next/link';
import { BookOpen, FileQuestion, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavbarProps {
  currentPage: 'wordbook' | 'practice';
}

export const Navbar = ({ currentPage }: NavbarProps) => {
  const { userInfo, logout } = useAuth();

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
              <BookOpen className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
              <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                广学英语
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 md:space-x-6">
            <Link
              href="/"
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                currentPage === 'wordbook'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">单词本</span>
            </Link>

            <Link
              href="/practice"
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                currentPage === 'practice'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <FileQuestion className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">题目</span>
            </Link>

            {/* 用户信息和登出 - 由于 SSR 限制，登出后需要刷新页面 */}
            {userInfo && (
              <div className="flex items-center space-x-2 sm:space-x-4 pl-2 sm:pl-4 border-l border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{userInfo.userName}</span>
                </div>
                <button
                  onClick={async () => {
                    await logout();
                    // 强制刷新页面以重新验证会话
                    if (typeof window !== 'undefined') {
                      window.location.href = '/';
                    }
                  }}
                  className="flex items-center space-x-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">登出</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

'use client';

import Link from 'next/link';
import { BookOpen, FileQuestion, HelpCircle, LogOut, User, Edit, Settings, Home } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavbarProps {
  currentPage: 'home' | 'wordbook' | 'practice' | 'writing' | 'settings' | 'admin';
}

const NAV_LINK_CLASSES = 'flex items-center space-x-1 @min-[560px]:space-x-1.5 sm:space-x-2 px-1.5 @min-[560px]:px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors shrink-0 whitespace-nowrap';

export const Navbar = ({ currentPage }: NavbarProps) => {
  const { userInfo, logout } = useAuth();

  return (
    <nav className="pt-safe px-safe bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="@container flex justify-between h-16">
          <div className="flex items-center shrink-0">
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3 shrink-0 whitespace-nowrap">
              <BookOpen className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
              <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                广学英语
              </span>
            </Link>
          </div>

          <div className="min-w-0 flex items-center space-x-1 @min-[560px]:space-x-2 sm:space-x-4 md:space-x-6 flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/"
              className={`${NAV_LINK_CLASSES} ${
                currentPage === 'home'
                  ? 'bg-red-100 text-brand-crimson dark:bg-red-900 dark:text-red-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden @min-[560px]:inline">首页</span>
            </Link>

            <Link
              href="/wordbooks"
              className={`${NAV_LINK_CLASSES} ${
                currentPage === 'wordbook'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden @min-[560px]:inline">单词本</span>
            </Link>

            <Link
              href="/writing"
              className={`${NAV_LINK_CLASSES} ${
                currentPage === 'writing'
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden @min-[640px]:inline">作文积累</span>
            </Link>

            <Link
              href="/practice"
              className={`${NAV_LINK_CLASSES} ${
                currentPage === 'practice'
                  ? 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <FileQuestion className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden @min-[560px]:inline">题目</span>
            </Link>

            <a
              href="https://docs.gxwtf.cn/#/english/"
              target="_blank"
              rel="noopener noreferrer"
              title="使用文档"
              className={`${NAV_LINK_CLASSES} text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800`}
            >
              <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden @min-[640px]:inline">使用文档</span>
            </a>

            {/* 用户信息和登出 - 由于 SSR 限制，登出后需要刷新页面 */}
            {userInfo && (
              <div className="flex items-center space-x-2 sm:space-x-4 pl-2 sm:pl-4 border-l border-gray-200 dark:border-gray-700 shrink-0">
                <Link
                  href="/settings"
                  className={`${NAV_LINK_CLASSES} ${
                    currentPage === 'settings'
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden @min-[560px]:inline">设置</span>
                </Link>
                <div className="hidden @min-[680px]:flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden @min-[680px]:inline max-w-[6em] truncate">{userInfo.userName}</span>
                </div>
                <button
                  onClick={async () => {
                    await logout();
                    // 强制刷新页面以重新验证会话
                    if (typeof window !== 'undefined') {
                      window.location.href = '/';
                    }
                  }}
                  className="flex items-center space-x-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors shrink-0 whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden @min-[560px]:inline">登出</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

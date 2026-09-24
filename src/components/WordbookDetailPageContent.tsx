'use client';

import { use, useEffect, useState } from 'react';
import { Loader2, BookOpen, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { AuthenticatedPage } from '@/components/AuthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { Wordbook } from '@/types/word';
import { getWordbook } from '@/actions/wordbooks';
import query from '@/actions/query';

export function WordbookDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isAll = id === 'all';
  const wordbookId = Number(id);
  const { isLoggedIn, isClient, isLoading } = useAuth();
  const [wordbook, setWordbook] = useState<Wordbook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isClient || !isLoggedIn) return;
    if (isAll) {
      setLoading(false);
      return;
    }
    if (!Number.isFinite(wordbookId)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getWordbook(wordbookId)
      .then((data) => {
        if (!cancelled) setWordbook(data);
      })
      .catch((error) => console.error('加载单词本失败:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isClient, isLoggedIn, wordbookId, isAll]);

  if (!isClient || isLoading || (isLoggedIn && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <UnauthenticatedPage />;
  }

  if (isAll) {
    return <AuthenticatedPage queryWord={query} wordbookName="所有单词" />;
  }

  if (!wordbook) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar currentPage="wordbook" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">单词本不存在或无权访问</p>
          <Link
            href="/wordbooks"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4" />
            返回我的单词本
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AuthenticatedPage
      queryWord={query}
      wordbookId={wordbookId}
      wordbookName={wordbook.name}
    />
  );
}

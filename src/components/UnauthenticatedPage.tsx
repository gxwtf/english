import { BookOpen, Brain, Sparkles, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const UnauthenticatedPage = () => {
  const { login } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex flex-col items-center text-center p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full blur-xl opacity-30"></div>
            <BookOpen className="relative w-full h-full text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
            广学英语
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            智能、高效的英语单词记忆软件
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mr-4">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                支持一词多义
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              深入掌握单词的多种含义和用法，提高阅读理解能力
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mr-4">
                <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI 出题
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              智能生成高考题型题目，针对性地提升应试能力
            </p>
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={login}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors mx-auto"
          >
            <LogIn className="w-5 h-5" />
            模拟登录
          </button>
        </div>

        <div className="mt-12 animate-pulse">
          <Sparkles className="w-8 h-8 text-yellow-500 mx-auto" />
        </div>
      </div>
    </div>
  );
};
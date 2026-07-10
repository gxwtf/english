'use client';

import { useState, useEffect } from 'react';
import { Settings, Tag as TagIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { TagEditModal } from '@/components/TagEditModal';
import { loadTagConfigs, saveTagConfigs } from '@/actions/words';
import type { WordTag, TagConfig } from '@/types/word';

export function SettingsPageContent() {
  const { isLoggedIn, isClient, isLoading } = useAuth();
  const [allTagConfigs, setAllTagConfigs] = useState<Record<WordTag, TagConfig>>({});
  const [showTagEditModal, setShowTagEditModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // 加载标签配置
  const loadTags = async () => {
    try {
      const loadedTagConfigs = await loadTagConfigs();
      setAllTagConfigs(loadedTagConfigs);
    } catch (error) {
      console.error('加载标签配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  // 处理标签配置更新
  const handleTagsUpdate = async (newTagConfigs: Record<WordTag, TagConfig>) => {
    try {
      await saveTagConfigs(newTagConfigs);
      setAllTagConfigs(newTagConfigs);
    } catch (error) {
      console.error('更新标签配置失败:', error);
    }
  };

  // 加载中状态
  if (!isClient || isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录状态
  if (!isLoggedIn) {
    return <UnauthenticatedPage />;
  }

  const menuItems = [
    {
      id: 'tags',
      icon: TagIcon,
      title: '标签管理',
      description: '创建、编辑和组织标签，单词本和作文积累本共用',
      onClick: () => setShowTagEditModal(true),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar currentPage="settings" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* 标题栏 */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              设置
            </h1>
          </div>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            管理您的应用设置和偏好
          </p>
        </div>

        {/* 设置菜单列表 */}
        <div className="space-y-3">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 text-left hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <IconComponent className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                  <div className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 提示信息 */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 提示：标签系统在单词本和作文积累本之间共享，修改标签会影响两个功能。
          </p>
        </div>
      </div>

      {/* 标签管理弹窗 */}
      <TagEditModal
        isOpen={showTagEditModal}
        onClose={() => setShowTagEditModal(false)}
        onTagsUpdate={handleTagsUpdate}
        currentTags={allTagConfigs}
      />
    </div>
  );
}
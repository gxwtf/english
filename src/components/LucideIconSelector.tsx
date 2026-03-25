'use client';

import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ICON_PRESETS } from '@/constants/word-tags';
import type { IconConfig } from '@/types/word';
import { IconBadge } from './IconBadge';

interface LucideIconSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onIconSelect: (iconId: string) => void;
  currentIconId?: string;
}

export const LucideIconSelector = ({
  isOpen,
  onClose,
  onIconSelect,
  currentIconId = 'dot'
}: LucideIconSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 过滤图标
  const filteredIcons = useMemo(() => {
    return ICON_PRESETS.filter(icon =>
      icon.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      icon.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  // 图标分类
  const categorizedIcons = useMemo(() => {
    const categories = {
      '基础图形': ICON_PRESETS.filter(icon =>
        ['circle', 'dot', 'square', 'triangle', 'diamond', 'star', 'heart'].includes(icon.id)
      ),
      '特殊符号': ICON_PRESETS.filter(icon =>
        ['diamond-solid', 'spade', 'club'].includes(icon.id)
      ),
      '星形变体': ICON_PRESETS.filter(icon =>
        ['star-four', 'star-eight', 'star-circle', 'star-dash', 'star-two', 'star-plus', 'star-cross', 'star-burst'].includes(icon.id)
      ),
      '闪光效果': ICON_PRESETS.filter(icon =>
        icon.id.startsWith('sparkle')
      ),
    };

    return categories;
  }, []);

  const handleIconSelect = (iconId: string) => {
    onIconSelect(iconId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              选择图标
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              选择一个图标来标记你的标签
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 搜索框 */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <label htmlFor="icon-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            搜索图标
          </label>
          <div className="relative">
            <Input
              id="icon-search"
              type="text"
              placeholder="搜索图标..."
              className="w-full px-4 py-2 pl-10 pr-4 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 当前选择 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">当前选择：</p>
          <div className="flex items-center gap-2">
            <IconBadge iconId={currentIconId} size="md" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {ICON_PRESETS.find(i => i.id === currentIconId)?.displayName || '未选择'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ID: {currentIconId}
              </p>
            </div>
          </div>
        </div>

        {/* 图标网格 */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {Object.entries(categorizedIcons).map(([categoryName, icons]) => (
              <div key={categoryName}>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {categoryName}
                </h4>
                <div className="grid grid-cols-8 gap-3">
                  {icons.map((icon) => (
                    <button
                      key={icon.id}
                      className={`group relative p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 hover:shadow-lg ${
                        currentIconId === icon.id
                          ? 'ring-2 ring-offset-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                      }`}
                      onClick={() => handleIconSelect(icon.id)}
                    >
                      {/* 悬停效果 */}
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>

                      {/* 图标 */}
                      <div className="relative flex items-center justify-center">
                        <IconBadge iconId={icon.id} size="md" />
                      </div>

                      {/* 选中指示器 */}
                      {currentIconId === icon.id && (
                        <div className="absolute -top-1 -right-1">
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* 悬停时的提示 */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        {icon.displayName}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* 底部统计 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              共 {filteredIcons.length} 个图标可供选择
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSearchTerm('')}>
                清除搜索
              </Button>
              <Button onClick={onClose}>
                确定
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
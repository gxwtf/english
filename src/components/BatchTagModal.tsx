'use client';

import { useState } from 'react';
import { X, Settings } from 'lucide-react';
import { WordTag, TagConfig } from '@/types/word';
import { COLOR_PRESETS } from '@/constants/word-tags';
import { TagEditModal } from '@/components/TagEditModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BatchTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tags: WordTag[]) => void;
  selectedCount: number;
  allTagConfigs: Record<WordTag, TagConfig>;
  onTagsUpdate?: (newTagConfigs: Record<WordTag, TagConfig>) => void;
}

export const BatchTagModal = ({
  isOpen,
  onClose,
  onSave,
  selectedCount,
  allTagConfigs,
  onTagsUpdate
}: BatchTagModalProps) => {
  const [selectedTags, setSelectedTags] = useState<WordTag[]>([]);
  const [showTagEditModal, setShowTagEditModal] = useState(false);

  const toggleTag = (tag: WordTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    onSave(selectedTags);
    setSelectedTags([]);
    onClose();
  };

  const handleClearAll = () => {
    setSelectedTags([]);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4" style={{ zIndex: 50 }}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              批量设置标签
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                将为选中的 {selectedCount} 个单词设置标签
              </p>
            </div>

            {/* 标签选择 */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  选择标签:
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTagEditModal(true)}
                  className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">标签管理</span>
                  <span className="sm:hidden">标签</span>
                </Button>
              </div>

              {/* 快捷操作 */}
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allTags = Object.keys(allTagConfigs) as WordTag[];
                    setSelectedTags(allTags);
                  }}
                  className="h-8 px-3 text-xs whitespace-nowrap"
                >
                  全选
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-8 px-3 text-xs whitespace-nowrap text-red-600 hover:text-red-700"
                >
                  清空（取消所有标签）
                </Button>
              </div>

              {/* 标签列表 */}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(allTagConfigs) as WordTag[]).map(tag => {
                  const tagConfig = allTagConfigs[tag];
                  if (!tagConfig) return null;
                  const isSelected = selectedTags.includes(tag);
                  const colorPreset = COLOR_PRESETS.find(c => c.id === tagConfig.colorId);

                  return (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={`
                        ${
                          isSelected
                            // 选中时保持原背景，添加蓝色边框
                            ? colorPreset
                              ? `${colorPreset.className} dark:bg-gray-800 dark:text-gray-300 ring-2 ring-blue-500 ring-offset-1 shadow-md`
                              : 'bg-blue-100 text-blue-800 border-blue-500 ring-2 ring-blue-500 ring-offset-1'
                            // 未选中时使用浅色背景
                            : colorPreset
                              ? `${colorPreset.className} dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-opacity-80`
                              : 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-opacity-80'
                        }
                        cursor-pointer transition-all hover:scale-105 hover:opacity-90
                      `}
                      onClick={() => toggleTag(tag)}
                    >
                      {tagConfig.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 底部 */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 gap-3">
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
              {selectedTags.length > 0 ? (
                <span>已选择 {selectedTags.length} 个标签</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">将取消所有标签</span>
              )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                取消
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 sm:flex-none min-w-[80px]"
              >
                应用
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showTagEditModal && (
        <TagEditModal
          isOpen={showTagEditModal}
          onClose={() => setShowTagEditModal(false)}
          onTagsUpdate={(newTagConfigs) => {
            setShowTagEditModal(false);
            onTagsUpdate?.(newTagConfigs);
          }}
          currentTags={allTagConfigs}
        />
      )}
    </>
  );
};
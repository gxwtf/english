'use client';

import { useState, useEffect } from 'react';
import { X, Settings } from 'lucide-react';
import { WritingEntry } from '@/actions/writing-entries';
import type { WordTag, TagConfig } from '@/types/word';
import { COLOR_PRESETS } from '@/constants/word-tags';
import { TagEditModal } from '@/components/TagEditModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface WritingEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { content: string; note?: string; tags?: string[] }) => void;
  initialEntry?: WritingEntry;
  allTagConfigs: Record<WordTag, TagConfig>;
  onTagsUpdate?: (newTagConfigs: Record<WordTag, TagConfig>) => void;
}

export const WritingEntryModal = ({
  isOpen,
  onClose,
  onSave,
  initialEntry,
  allTagConfigs,
  onTagsUpdate
}: WritingEntryModalProps) => {
  const [content, setContent] = useState('');
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagEditModal, setShowTagEditModal] = useState(false);

  useEffect(() => {
    if (initialEntry) {
      setContent(initialEntry.content);
      setNote(initialEntry.note || '');
      setSelectedTags(initialEntry.tags);
    } else {
      setContent('');
      setNote('');
      setSelectedTags([]);
    }
  }, [initialEntry, isOpen]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    if (!content.trim()) return;
    onSave({
      content: content.trim(),
      note: note.trim() || undefined,
      tags: selectedTags
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-3">
        <div className="p-4 sm:p-6">
          {/* 标题 */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              {initialEntry ? '编辑积累内容' : '添加积累内容'}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 内容输入 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="输入单词、短语或句子..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                备注（可选）
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="添加备注说明..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  标签（可选）
                </label>
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
                            ? colorPreset
                              ? `${colorPreset.className} dark:bg-gray-800 dark:text-gray-300 ring-2 ring-blue-500 ring-offset-1 shadow-md`
                              : 'bg-blue-100 text-blue-800 border-blue-500 ring-2 ring-blue-500 ring-offset-1'
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

          {/* 操作按钮 */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={!content.trim()}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            >
              {initialEntry ? '保存' : '添加'}
            </Button>
          </div>
        </div>
      </div>

      {/* 标签管理弹窗 */}
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
    </div>
  );
};
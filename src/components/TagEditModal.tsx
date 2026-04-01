'use client';

import { useState, useRef } from 'react';
import { X, Plus, Edit2, Trash2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COLOR_PRESETS } from '@/constants/word-tags';
import type { WordTag, TagConfig, ColorConfig } from '@/types/word';
import { ColorSelector } from '@/components/ColorSelector';

interface TagEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagsUpdate: (tags: Record<WordTag, TagConfig>) => void;
  currentTags: Record<WordTag, TagConfig>;
}

export const TagEditModal = ({ isOpen, onClose, onTagsUpdate, currentTags }: TagEditModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [editingTag, setEditingTag] = useState<WordTag | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColorId, setNewTagColorId] = useState('blue');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [showColorSelector, setShowColorSelector] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState<WordTag | null>(null);

  // 重置编辑状态
  const resetEdit = () => {
    setEditingTag(null);
    setIsEditing(false);
    setNewTagName('');
    setNewTagColorId('blue');
    setNewTagDescription('');
    setShowColorSelector(false);
  };

  // 添加新标签
  const handleAddTag = () => {
    if (!newTagName.trim()) return;

    // 生成唯一的标签 ID
    const newTagId = newTagName.trim().toUpperCase().replace(/\s+/g, '_') as any;

    const newTagConfig: TagConfig = {
      id: newTagId,
      name: newTagName.trim(),
      colorId: newTagColorId,
      description: newTagDescription.trim() || newTagName.trim()
    };

    // 更新标签配置
    const updatedTags = { ...currentTags, [newTagId]: newTagConfig };
    onTagsUpdate(updatedTags);

    resetEdit();
  };

  // 更新现有标签
  const handleUpdateTag = () => {
    if (!editingTag || !newTagName.trim()) return;

    const updatedTags = {
      ...currentTags,
      [editingTag]: {
        ...currentTags[editingTag],
        name: newTagName.trim(),
        colorId: newTagColorId,
        description: newTagDescription.trim() || currentTags[editingTag].description
      }
    } as any;

    onTagsUpdate(updatedTags);
    resetEdit();
  };

  // 删除标签
  const confirmDeleteTag = (tagToDelete: WordTag) => {
    const updatedTags = { ...currentTags };
    delete updatedTags[tagToDelete];

    onTagsUpdate(updatedTags);
    setIsDeleting(null);
  };

  const handleDeleteTag = (tagToDelete: WordTag) => {
    setIsDeleting(tagToDelete);
  };

  // 开始编辑标签
  const startEditingTag = (tag: WordTag) => {
    const tagConfig = currentTags[tag];

    setEditingTag(tag);
    setIsEditing(true);
    setNewTagName(tagConfig.name);
    setNewTagColorId(tagConfig.colorId || 'blue');
    setNewTagDescription(tagConfig.description);

    // 滚动到标签管理窗口的顶部
    setTimeout(() => {
      try {
        // 方法1：直接使用模态框的ref
        if (modalRef.current) {
          modalRef.current.scrollTop = 0;
        }

        // 方法2：使用CSS选择器找到内容区域
        const contentArea = modalRef.current?.querySelector('.flex-1');
        if (contentArea) {
          contentArea.scrollTop = 0;
        }

        // 方法3：使用window方法（作为备选）
        window.scroll({ top: 0, behavior: 'instant' });
      } catch (e) {
        console.warn('滚动到标签管理窗口顶部失败:', e);
      }
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white">
              <span className="text-lg">🏷️</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                标签管理
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                创建、编辑和组织你的单词标签
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-6">
          {/* 添加/编辑标签 */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {isEditing ? '编辑标签' : '添加新标签'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  标签名称
                </label>
                <Input
                  placeholder="输入标签名称"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
              </div>

              {/* 颜色选择 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  <Palette className="h-4 w-4" />
                  选择颜色
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    颜色
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowColorSelector(true)}
                    className="w-full justify-start"
                  >
                    <div className={`w-4 h-4 rounded-full mr-2 ${COLOR_PRESETS.find(c => c.id === newTagColorId)?.bgClass || 'bg-gray-200'}`}></div>
                    {COLOR_PRESETS.find(c => c.id === newTagColorId)?.name || '选择颜色'}
                  </Button>
                </div>

                {/* 预设颜色快速选择 */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    预设颜色
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {COLOR_PRESETS.slice(0, 6).map((color) => {
                      const isSelected = newTagColorId === color.id;
                      return (
                        <button
                          key={color.id}
                          className={`h-10 rounded-lg border-2 transition-all duration-200 transform hover:scale-105 ${
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-blue-500 border-blue-500'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                          onClick={() => setNewTagColorId(color.id)}
                        >
                          <div className={`h-full w-full rounded-md ${color.className} flex items-center justify-center`}>
                            <span className="text-xs font-medium">{color.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  描述（可选）
                </label>
                <Input
                  placeholder="输入标签描述"
                  value={newTagDescription}
                  onChange={(e) => setNewTagDescription(e.target.value)}
                />
              </div>

              {isEditing ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetEdit} className="flex-1">
                    取消
                  </Button>
                  <Button onClick={handleUpdateTag} className="flex-1">
                    <Edit2 className="h-4 w-4 mr-2" />
                    保存修改
                  </Button>
                </div>
              ) : (
                <Button onClick={handleAddTag} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  添加标签
                </Button>
              )}
            </div>
          </div>

          {/* 现有标签列表 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                现有标签
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                共 {Object.keys(currentTags).length} 个标签
              </span>
            </div>

            <div className="space-y-3">
              {(Object.keys(currentTags) as WordTag[]).map(tag => {
                const tagConfig = currentTags[tag];
                if (!tagConfig) return null;

                return (
                  <div
                    key={tag}
                    className="group relative p-4 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-200"
                  >
                    {/* 标签预览 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* 标签颜色 */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${COLOR_PRESETS.find(c => c.id === tagConfig.colorId)?.className || 'bg-gray-200'} shadow-sm`}>
                          <span className="text-lg">{tagConfig.name.charAt(0).toUpperCase()}</span>
                        </div>

                        {/* 标签信息 */}
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {tagConfig.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {tagConfig.description}
                          </div>
                          <div className="mt-1">
                            <Badge variant="outline" className="text-xs">
                              ID: {tag}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingTag(tag)}
                          className="h-8 w-8 p-0"
                          title="编辑标签"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTag(tag)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="删除标签"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* 底部分隔线 */}
                    <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-600 to-transparent"></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="flex justify-end p-6 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={() => {
              resetEdit();
              onClose();
            }}
            className="px-6 py-2"
          >
            完成管理
          </Button>
        </div>
      </div>

      {/* 颜色选择器 */}
      {showColorSelector && (
        <ColorSelector
          isOpen={showColorSelector}
          onClose={() => setShowColorSelector(false)}
          onColorSelect={(color) => {
            setNewTagColorId(color.id);
            setShowColorSelector(false);
          }}
          currentColorId={newTagColorId}
        />
      )}

      {/* 删除确认对话框 */}
      {isDeleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                确认删除标签
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                确定要删除标签 "{currentTags[isDeleting]?.name}" 吗？此操作无法撤销。
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleting(null)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={() => confirmDeleteTag(isDeleting)}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  确认删除
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import { useState } from 'react';
import { X, Plus, Edit2, Trash2, Palette, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COLOR_PRESETS, ICON_PRESETS, ICON_OPTIONS } from '@/constants/word-tags';
import type { WordTag, TagConfig, ColorConfig, IconConfig } from '@/types/word';
import { IconSelector } from '@/components/IconSelector';
import { LucideIconSelector } from '@/components/LucideIconSelector';
import { IconBadge } from '@/components/IconBadge';
import { ColorSelector } from '@/components/ColorSelector';

interface TagEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagsUpdate: (tags: Record<WordTag, TagConfig>) => void;
  currentTags: Record<WordTag, TagConfig>;
}

export const TagEditModal = ({ isOpen, onClose, onTagsUpdate, currentTags }: TagEditModalProps) => {
  const [editingTag, setEditingTag] = useState<WordTag | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColorId, setNewTagColorId] = useState('blue');
  const [newTagIconId, setNewTagIconId] = useState('dot');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [showLucideIconSelector, setShowLucideIconSelector] = useState(false);
  const [showColorSelector, setShowColorSelector] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchIcon, setSearchIcon] = useState('');
  const [isDeleting, setIsDeleting] = useState<WordTag | null>(null);

  // 重置编辑状态
  const resetEdit = () => {
    setEditingTag(null);
    setIsEditing(false);
    setNewTagName('');
    setNewTagColorId('blue');
    setNewTagIconId('dot');
    setNewTagDescription('');
    setShowIconSelector(false);
    setShowLucideIconSelector(false);
    setShowColorSelector(false);
    setSearchIcon('');
  };

  // 过滤图标
  const filteredIcons = ICON_PRESETS.filter(icon =>
    icon.symbol.toLowerCase().includes(searchIcon.toLowerCase())
  );

  // 添加新标签
  const handleAddTag = () => {
    if (!newTagName.trim()) return;

    // 生成唯一的标签ID
    const newTagId = newTagName.trim().toUpperCase().replace(/\s+/g, '_') as any;

    const newTagConfig: TagConfig = {
      id: newTagId,
      name: newTagName.trim(),
      iconId: newTagIconId,
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
        iconId: newTagIconId,
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
    setNewTagIconId(tagConfig.iconId || 'dot');
    setNewTagDescription(tagConfig.description);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
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
              {/* 独立的颜色和图标选择 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  <Palette className="h-4 w-4" />
                  选择颜色和图标
                </label>

                <div className="space-y-4">
                  {/* 颜色选择 */}
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
                      <div className={`w-4 h-4 rounded-full mr-2 ${COLOR_PRESETS.find(c => c.id === newTagColorId)?.className || 'bg-gray-200'}`}></div>
                      {COLOR_PRESETS.find(c => c.id === newTagColorId)?.name || '选择颜色'}
                    </Button>
                  </div>

                  {/* 图标选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      图标
                    </label>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowLucideIconSelector(true)}
                        className="w-full justify-start"
                      >
                        <IconBadge iconId={newTagIconId} size="md" className="mr-2" />
                        {ICON_PRESETS.find(i => i.id === newTagIconId)?.displayName || '选择图标'} (推荐)
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowIconSelector(true)}
                        className="w-full justify-start"
                      >
                        <span className="text-lg mr-2">{ICON_PRESETS.find(i => i.id === newTagIconId)?.symbol || '●'}</span>
                        选择传统字符图标
                      </Button>
                    </div>
                  </div>

                  {/* 预设组合快速选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      预设组合
                    </label>
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                      {COLOR_PRESETS.slice(0, 6).map((color) => (
                        ICON_PRESETS.slice(0, 4).map((icon) => {
                          const isSelected = newTagColorId === color.id && newTagIconId === icon.id;
                          return (
                            <button
                              key={`${color.id}-${icon.id}`}
                              className={`group relative h-12 rounded-lg border-2 transition-all duration-200 transform hover:scale-105 hover:shadow-lg ${
                                isSelected
                                  ? 'ring-2 ring-offset-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                              }`}
                              onClick={() => {
                                setNewTagColorId(color.id);
                                setNewTagIconId(icon.id);
                              }}
                            >
                              {/* 内容 - 只在未选中时显示颜色背景 */}
                              <div className={`relative h-full w-full flex flex-col items-center justify-center rounded-lg ${
                                isSelected
                                  ? `${COLOR_PRESETS.find(c => c.id === color.id)?.className || 'bg-gray-200'} opacity-100`
                                  : ''
                              }`}>
                                <IconBadge iconId={icon.id} size="md" />
                              </div>
                              {/* 选中指示器 */}
                              {isSelected && (
                                <div className="absolute -top-1 -right-1">
                                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                    <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })
                      ))}
                    </div>
                  </div>
                </div>

                {/* 当前选择的预览 */}
                <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">当前选择预览：</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${COLOR_PRESETS.find(c => c.id === newTagColorId)?.className || 'bg-gray-200'}`}>
                      <IconBadge iconId={newTagIconId} size="md" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {newTagName || '未命名标签'}
                    </span>
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
                        {/* 标签颜色和图标 */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${COLOR_PRESETS.find(c => c.id === tagConfig.colorId)?.className || 'bg-gray-200'} shadow-sm`}>
                          <IconBadge iconId={tagConfig.iconId} size="lg" />
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

      {/* 美观的图标选择器 */}
      {showIconSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowIconSelector(false)}
                className="p-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* 搜索框 */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <label htmlFor="icon-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                搜索图标
              </label>
              <div className="relative">
                <input
                  id="icon-search"
                  type="text"
                  placeholder="搜索图标..."
                  className="w-full px-4 py-2 pl-10 pr-4 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchIcon}
                  onChange={(e) => setSearchIcon(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 图标网格 */}
            <ScrollArea className="flex-1 p-6">
              <div className="grid grid-cols-8 gap-3">
                {filteredIcons.map((icon) => (
                  <button
                    key={icon.id}
                    className={`group relative p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 hover:shadow-lg ${
                      newTagIconId === icon.id
                        ? 'ring-2 ring-offset-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                    }`}
                    onClick={() => {
                      setNewTagIconId(icon.id);
                      setShowIconSelector(false);
                    }}
                  >
                    {/* 悬停效果 */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>

                    {/* 图标 */}
                    <div className="relative flex items-center justify-center">
                      <span className="text-2xl">{icon.symbol}</span>
                    </div>

                    {/* 选中指示器 */}
                    {newTagIconId === icon.id && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* 底部快捷操作 */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredIcons.length} 个图标可供选择
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowIconSelector(false)}
                >
                  确定
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Lucide 图标选择器 */}
      {showLucideIconSelector && (
        <LucideIconSelector
          isOpen={showLucideIconSelector}
          onClose={() => setShowLucideIconSelector(false)}
          onIconSelect={(iconId) => {
            setNewTagIconId(iconId);
            setShowLucideIconSelector(false);
          }}
          currentIconId={newTagIconId}
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
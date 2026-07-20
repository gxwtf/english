'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { WordTag, TagConfig } from '@/types/word';
import { COLOR_PRESETS } from '@/constants/word-tags';
import { ColorSelector } from '@/components/ColorSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { ColorConfig } from '@/types/word';
import { countTagUsage, deleteTag } from '@/actions/words';

interface TagEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagsUpdate: (newTagConfigs: Record<WordTag, TagConfig>) => void;
  currentTags: Record<WordTag, TagConfig>;
}

export const TagEditModal = ({ isOpen, onClose, onTagsUpdate, currentTags }: TagEditModalProps) => {
  const [editingTag, setEditingTag] = useState<WordTag | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState<string>('blue');
  const [showColorSelector, setShowColorSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTag, setDeletingTag] = useState<WordTag | null>(null);
  const [tagUsage, setTagUsage] = useState<{ wordCount: number; writingCount: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const tagKey = 'custom-' + newTagName.trim().toLowerCase().replace(/\s+/g, '-');
    const displayName = newTagName.trim();
    if (currentTags[tagKey as WordTag]) return;
    const hasSameDisplayName = Object.values(currentTags).some(config => config.name === displayName);
    if (hasSameDisplayName) return;

    const newTag: TagConfig = {
      id: tagKey,
      name: displayName,
      colorId: 'blue',
      description: '',
    };
    onTagsUpdate({
      ...currentTags,
      [tagKey as WordTag]: newTag,
    });
    setNewTagName('');
  };

  const handleDeleteTag = async () => {
    if (!deletingTag) return;
    setDeleting(true);
    try {
      await deleteTag(deletingTag);
      const newTags = { ...currentTags };
      delete newTags[deletingTag];
      onTagsUpdate(newTags);
    } catch (error) {
      console.error('删除标签失败:', error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeletingTag(null);
      setTagUsage(null);
    }
  };

  const handleOpenDeleteConfirm = async (tag: WordTag) => {
    setDeletingTag(tag);
    const usage = await countTagUsage(currentTags[tag]?.name || tag);
    setTagUsage(usage);
    setShowDeleteConfirm(true);
  };

  const handleEditTag = (tag: WordTag) => {
    setEditingTag(tag);
    setEditingTagName(currentTags[tag].name);
    setEditingTagColor(currentTags[tag].colorId);
  };

  const handleSaveEdit = () => {
    if (!editingTag || !editingTagName.trim()) return;
    const updatedTags = { ...currentTags };
    updatedTags[editingTag] = {
      id: editingTag,
      name: editingTagName.trim(),
      colorId: editingTagColor,
      description: currentTags[editingTag]?.description || '',
    };
    onTagsUpdate(updatedTags);
    setEditingTag(null);
  };

  const handleColorSelect = (color: ColorConfig) => {
    setEditingTagColor(color.id);
    setShowColorSelector(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>标签管理</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4">
            {/* 添加新标签 */}
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="新标签名称"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button onClick={handleAddTag} disabled={!newTagName.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>

            {/* 标签列表 */}
            <div className="space-y-2">
              {(Object.entries(currentTags) as [WordTag, TagConfig][]).map(([tag, config]) => {
                const colorPreset = COLOR_PRESETS.find(c => c.id === config.colorId);
                return (
                  <div
                    key={tag}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      editingTag === tag
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                        : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                  >
                    {editingTag === tag ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          className="flex-1"
                          autoFocus
                        />
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowColorSelector(true)}
                            className={`w-6 h-6 rounded-full border-2 border-gray-300 ${colorPreset?.bgClass || 'bg-gray-200'}`}
                            title="更改颜色"
                          />
                          <Button size="sm" variant="ghost" onClick={handleSaveEdit}>
                            保存
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingTag(null)}>
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`${colorPreset?.className || 'bg-gray-200 text-gray-700'} dark:bg-gray-800 dark:text-gray-300`}
                          >
                            {config.name}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditTag(tag)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDeleteConfirm(tag)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除标签「{deletingTag ? currentTags[deletingTag]?.name : ''}」吗？
            </DialogDescription>
          </DialogHeader>
          {tagUsage && (tagUsage.wordCount > 0 || tagUsage.writingCount > 0) && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <p className="font-medium mb-1">该标签正在被使用</p>
                  <ul className="space-y-0.5">
                    {tagUsage.wordCount > 0 && (
                      <li>• {tagUsage.wordCount} 个单词</li>
                    )}
                    {tagUsage.writingCount > 0 && (
                      <li>• {tagUsage.writingCount} 个作文积累</li>
                    )}
                  </ul>
                  <p className="mt-2 text-xs">删除后将自动从相关内容中移除该标签</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteTag} disabled={deleting}>
              {deleting ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 颜色选择器 */}
      <ColorSelector
        isOpen={showColorSelector}
        onClose={() => setShowColorSelector(false)}
        onColorSelect={handleColorSelect}
        currentColorId={editingTagColor}
      />
    </>
  );
};

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { WritingToolbar } from '@/components/WritingToolbar';
import { WritingEntryCard } from '@/components/WritingEntryCard';
import { WritingEntryModal } from '@/components/WritingEntryModal';
import { BatchTagModal } from '@/components/BatchTagModal';
import { WritingEntry, loadWritingEntries, saveWritingEntry, deleteWritingEntries, updateWritingEntryTags } from '@/actions/writing-entries';
import { loadTagConfigs, saveTagConfigs } from '@/actions/words';
import { generateWritingEntriesPdf } from '@/lib/pdf-generator';
import type { WordTag, TagConfig } from '@/types/word';

export function WritingPageContent() {
  const { isLoggedIn, isClient, isLoading } = useAuth();
  const [entries, setEntries] = useState<WritingEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'alphabet'>('default');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterLogic, setFilterLogic] = useState<'and' | 'or'>('and');
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WritingEntry | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBatchTagModal, setShowBatchTagModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allTagConfigs, setAllTagConfigs] = useState<Record<WordTag, TagConfig>>({});

  // 加载数据
  const loadData = async () => {
    try {
      const [loadedEntries, loadedTagConfigs] = await Promise.all([
        loadWritingEntries(),
        loadTagConfigs()
      ]);
      setEntries(loadedEntries);
      setAllTagConfigs(loadedTagConfigs);
    } catch (error) {
      console.error('加载作文积累失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 筛选和排序
  const filteredEntries = useMemo(() => {
    let filtered = entries;

    // 搜索筛选
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.content.toLowerCase().includes(term) ||
        (entry.note && entry.note.toLowerCase().includes(term))
      );
    }

    // 标签筛选
    if (filterTags.length > 0) {
      if (filterLogic === 'and') {
        filtered = filtered.filter(entry =>
          filterTags.every(tag => entry.tags.includes(tag))
        );
      } else {
        filtered = filtered.filter(entry =>
          filterTags.some(tag => entry.tags.includes(tag))
        );
      }
    }

    // 排序
    if (sortBy === 'alphabet') {
      filtered = [...filtered].sort((a, b) =>
        a.content.localeCompare(b.content, 'en')
      );
    }

    return filtered;
  }, [entries, searchTerm, filterTags, filterLogic, sortBy]);

  // 处理保存
  const handleSave = async (data: { content: string; note?: string; tags?: string[] }) => {
    try {
      const savedEntry = await saveWritingEntry({
        id: editingEntry?.id,
        ...data
      });

      setEntries(prev => {
        if (editingEntry) {
          const index = prev.findIndex(e => e.id === editingEntry.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = savedEntry;
            return updated;
          }
        }
        return [savedEntry, ...prev];
      });
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  // 处理删除
  const handleDelete = async (id: number) => {
    try {
      await deleteWritingEntries([id]);
      setEntries(prev => prev.filter(e => e.id !== id));
      setSelectedIds(prev => prev.filter(entryId => entryId !== id));
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  // 处理批量删除
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await deleteWritingEntries(selectedIds);
      setEntries(prev => prev.filter(e => !selectedIds.includes(e.id)));
      setSelectedIds([]);
    } catch (error) {
      console.error('删除失败:', error);
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  // 处理选择
  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(entryId => entryId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = useCallback(() => {
    if (selectedIds.length === filteredEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEntries.map(e => e.id));
    }
  }, [filteredEntries, selectedIds.length]);

  // 处理标签点击（快速筛选）
  const handleTagClick = (tag: string) => {
    if (filterTags.includes(tag)) {
      setFilterTags(prev => prev.filter(t => t !== tag));
    } else {
      setFilterTags([...filterTags, tag]);
    }
  };

  // 处理批量设置标签
  const handleBatchTagUpdate = async (newTags: string[]) => {
    if (selectedIds.length === 0) return;
    
    try {
      await updateWritingEntryTags(selectedIds, newTags);
      await loadData(); // 重新加载数据
      setSelectedIds([]);
    } catch (error) {
      console.error('批量设置标签失败:', error);
    }
  };

  // 处理标签配置更新
  const handleTagConfigUpdate = async (newTagConfigs: Record<WordTag, TagConfig>) => {
    try {
      await saveTagConfigs(newTagConfigs);
      setAllTagConfigs(newTagConfigs);
    } catch (error) {
      console.error('更新标签配置失败:', error);
    }
  };

  // 处理导出PDF
  const handleExportPdf = async () => {
    const selectedEntries = selectedIds.length > 0
      ? entries.filter(e => selectedIds.includes(e.id))
      : filteredEntries;
    
    if (selectedEntries.length === 0) {
      alert('请先选择要导出的积累内容');
      return;
    }

    try {
      await generateWritingEntriesPdf(selectedEntries);
    } catch (error) {
      console.error('导出PDF失败:', error);
      alert('导出PDF失败，请重试');
    }
  };

  // 加载中状态
  if (!isClient || isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar currentPage="writing" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              我的作文积累本
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 truncate">
              共 {entries.length} 个积累，{filteredEntries.length} 个符合条件
            </p>
          </div>

          <button
            onClick={() => {
              setEditingEntry(undefined);
              setShowModal(true);
            }}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1 sm:gap-2 transition-all shadow-lg hover:shadow-xl text-sm sm:text-base"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">添加积累</span>
            <span className="sm:hidden">添加</span>
          </button>
        </div>

        {/* 工具栏 */}
        <WritingToolbar
          selectedEntryIds={selectedIds}
          allEntryIds={filteredEntries.map(e => e.id)}
          sortBy={sortBy}
          filterTags={filterTags}
          filterLogic={filterLogic}
          searchTerm={searchTerm}
          allTagConfigs={allTagConfigs}
          onToggleSelectAll={handleToggleSelectAll}
          onSort={setSortBy}
          onFilterChange={(tags, logic) => {
            setFilterTags(tags);
            setFilterLogic(logic);
          }}
          onDeleteSelected={() => setShowDeleteConfirm(true)}
          onSearchChange={setSearchTerm}
          onSetTags={() => setShowBatchTagModal(true)}
          onExportPdf={handleExportPdf}
        />

        {/* 确认删除弹窗 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 mx-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                确认删除
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6">
                确定要删除选中的 {selectedIds.length} 条积累吗？此操作不可恢复。
              </p>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full sm:w-auto px-4 py-2 text-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 积累列表 */}
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-600 mb-4">
              {entries.length === 0 ? (
                <p>还没有添加任何积累内容</p>
              ) : (
                <p>没有符合条件的积累内容</p>
              )}
            </div>
            {entries.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                点击添加第一条积累
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map(entry => (
              <WritingEntryCard
                key={entry.id}
                entry={entry}
                isSelected={selectedIds.includes(entry.id)}
                onToggleSelect={handleToggleSelect}
                onEdit={(entry) => {
                  setEditingEntry(entry);
                  setShowModal(true);
                }}
                onDelete={handleDelete}
                onTagClick={handleTagClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      <WritingEntryModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingEntry(undefined);
        }}
        onSave={handleSave}
        initialEntry={editingEntry}
        allTagConfigs={allTagConfigs}
        onTagsUpdate={handleTagConfigUpdate}
      />

      {/* 批量设置标签弹窗 */}
      <BatchTagModal
        isOpen={showBatchTagModal}
        onClose={() => setShowBatchTagModal(false)}
        onUpdateTags={handleBatchTagUpdate}
        selectedCount={selectedIds.length}
        currentTags={allTagConfigs}
      />
    </div>
  );
}
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  CheckSquare,
  SortAsc,
  List,
  Filter,
  Sparkles,
  Trash2,
  Search,
  Settings
} from 'lucide-react';
import { WordTag, TagConfig } from '@/types/word';
import { COLOR_PRESETS } from '@/constants/word-tags';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TagEditModal } from '@/components/TagEditModal';

interface WordToolbarProps {
  selectedWordIds: number[];
  allWordIds: number[];
  sortBy: 'default' | 'alphabet';
  filterTags: WordTag[];
  filterLogic: 'and' | 'or';
  searchTerm: string;
  allTagConfigs: Record<WordTag, TagConfig>;
  onToggleSelectAll: () => void;
  onSort: (sort: 'default' | 'alphabet') => void;
  onFilterChange: (tags: WordTag[], logic: 'and' | 'or') => void;
  onTagConfigsUpdate: (newConfigs: Record<WordTag, TagConfig>) => void;
  onAIGenerate: () => void;
  onDeleteSelected: () => void;
  onSearchChange: (term: string) => void;
}

export const WordToolbar = ({
  selectedWordIds,
  allWordIds,
  sortBy,
  filterTags,
  filterLogic,
  searchTerm,
  allTagConfigs,
  onToggleSelectAll,
  onSort,
  onFilterChange,
  onTagConfigsUpdate,
  onAIGenerate,
  onDeleteSelected,
  onSearchChange
}: WordToolbarProps) => {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showTagEditModal, setShowTagEditModal] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isAllSelected = selectedWordIds.length === allWordIds.length && allWordIds.length > 0;
  const canGenerateAI = selectedWordIds.length > 0;
  const canDeleteSelected = selectedWordIds.length > 0;

  const filteredAndSortedWords = useMemo(() => {
    // 这里会在主组件中实现
    return [];
  }, []);

  const handleTagToggle = (tag: WordTag) => {
    const newTags = filterTags.includes(tag)
      ? filterTags.filter(t => t !== tag)
      : [...filterTags, tag];
    onFilterChange(newTags, filterLogic);
  };

  const handleFilterLogicToggle = () => {
    onFilterChange(filterTags, filterLogic === 'and' ? 'or' : 'and');
  };

  const handleTagConfigUpdate = (newTagConfigs: Record<WordTag, TagConfig>) => {
    onTagConfigsUpdate(newTagConfigs);
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* 左侧操作区 */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSelectAll}
            className="h-9"
          >
            {isAllSelected ? (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                取消全选
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                全选
              </>
            )}
          </Button>

          <div className="flex gap-1">
            <Button
              variant={sortBy === 'alphabet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSort('alphabet')}
              className="h-9"
            >
              <SortAsc className="h-4 w-4 mr-2" />
              首字母排序
            </Button>
            <Button
              variant={sortBy === 'default' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSort('default')}
              className="h-9"
            >
              <List className="h-4 w-4 mr-2" />
              默认排序
            </Button>
          </div>

          <div className="relative" ref={filterDropdownRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="h-9"
            >
              <Filter className="h-4 w-4 mr-2" />
              筛选
              {filterTags.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {filterTags.length}
                </Badge>
              )}
            </Button>

            {showFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                <div className="p-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    选择标签筛选
                  </p>

                  <div className="space-y-2 mb-4">
                    {(Object.keys(allTagConfigs) as WordTag[]).map(tag => {
                      const tagConfig = allTagConfigs[tag];
                      if (!tagConfig) return null;
                      const inputId = `tag-filter-${tag}`;
                      return (
                        <label
                          key={tag}
                          htmlFor={inputId}
                          className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={filterTags.includes(tag)}
                            onChange={() => handleTagToggle(tag)}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                          <span className={`${COLOR_PRESETS.find(c => c.id === tagConfig.colorId)?.className || 'bg-gray-200'} text-sm px-2 py-1 rounded-full`}>
                            {tagConfig.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      筛选逻辑:
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFilterLogicToggle}
                      className="text-xs"
                    >
                      {filterLogic === 'and' ? '全部满足' : '任一满足'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <div className="relative">
            <label htmlFor="word-search" className="sr-only">搜索单词</label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="word-search"
              placeholder="搜索单词..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 w-48 h-9"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onAIGenerate}
            disabled={!canGenerateAI}
            className="h-9"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI 出题
            {canGenerateAI && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {selectedWordIds.length}
              </Badge>
            )}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
            disabled={!canDeleteSelected}
            className="h-9"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            删除选中
            {canDeleteSelected && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-red-100 text-red-700">
                {selectedWordIds.length}
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTagEditModal(true)}
            className="h-9"
          >
            <Settings className="h-4 w-4 mr-2" />
            标签管理
          </Button>
        </div>
      </div>

      {/* 标签管理弹窗 */}
      <TagEditModal
        isOpen={showTagEditModal}
        onClose={() => setShowTagEditModal(false)}
        onTagsUpdate={handleTagConfigUpdate}
        currentTags={allTagConfigs}
      />
    </div>
  );
};
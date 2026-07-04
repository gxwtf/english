'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  SortAsc,
  List,
  Filter,
  Sparkles,
  Trash2,
  Search,
  Settings,
  Tag,
  FileDown,
  Loader2
} from 'lucide-react';
import { WordTag, TagConfig } from '@/types/word';
import { COLOR_PRESETS } from '@/constants/word-tags';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TagEditModal } from '@/components/TagEditModal';
import { BatchTagModal } from '@/components/BatchTagModal';

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
  onExportSelected: () => void;
  onDeleteSelected: () => void;
  isExportingSelected?: boolean;
  onSearchChange: (term: string) => void;
  onSetTags: (tags: WordTag[]) => void;
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
  onExportSelected,
  onDeleteSelected,
  onSearchChange,
  onSetTags,
  isExportingSelected = false
}: WordToolbarProps) => {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  const [showTagEditModal, setShowTagEditModal] = useState(false);
  const [showBatchTagModal, setShowBatchTagModal] = useState(false);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // 查找所有可能的下拉框（桌面端和移动端）
      const dropdowns = document.querySelectorAll('[data-filter-dropdown-inner], [data-batch-dropdown-inner]');

      // 检查点击是否在任意一个下拉框内部
      const isInDropdown = Array.from(dropdowns).some(dropdown =>
        dropdown.contains(target as Element)
      );

      // 如果点击的是下拉框内部，不关闭
      if (isInDropdown) {
        return;
      }

      // 如果点击的是筛选按钮，不关闭（让按钮的 onClick 处理）
      const filterButton = document.querySelector('[data-filter-button]');
      if (filterButton && filterButton.contains(target as Element)) {
        return;
      }

      // 如果点击的是批量操作按钮，不关闭（让按钮的 onClick 处理）
      const batchButton = document.querySelector('[data-batch-button]');
      if (batchButton && batchButton.contains(target as Element)) {
        return;
      }

      // 点击外部关闭下拉框
      setShowFilterDropdown(false);
      setShowBatchDropdown(false);
    };

    // 在捕获阶段监听，这样可以在事件被 React 处理前先拦截
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []);

  const isAllSelected = selectedWordIds.length === allWordIds.length && allWordIds.length > 0;
  const canBatchOperate = selectedWordIds.length > 0;

  const handleOpenBatchTagModal = () => {
    setShowBatchDropdown(false);
    setShowBatchTagModal(true);
  };

  const filteredAndSortedWords = useMemo(() => {
    // 这里会在主组件中实现
    return [];
  }, []);

  const handleTagToggle = (tag: WordTag, event?: React.MouseEvent | React.ChangeEvent<HTMLInputElement>) => {
    if (event) {
      event.stopPropagation();
    }
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
    <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      {/* 桌面端：左右布局 */}
      <div className="hidden md:flex items-center justify-between gap-3">
        {/* 左侧：选择和排序 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSelectAll}
            className="h-9 text-sm"
          >
            {isAllSelected ? (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                <span>取消全选</span>
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                <span>全选</span>
              </>
            )}
          </Button>

          <div className="flex gap-1">
            <Button
              variant={sortBy === 'alphabet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSort('alphabet')}
              className="h-9 text-sm"
            >
              <SortAsc className="h-4 w-4 mr-2" />
              <span>首字母排序</span>
            </Button>
            <Button
              variant={sortBy === 'default' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSort('default')}
              className="h-9 text-sm"
            >
              <List className="h-4 w-4 mr-2" />
              <span>默认</span>
            </Button>
          </div>

          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              data-filter-button
              onClick={(e) => {
                e.stopPropagation();
                setShowFilterDropdown((prev) => !prev);
              }}
              className="h-9 text-sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              <span>筛选</span>
              {filterTags.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {filterTags.length}
                </Badge>
              )}
            </Button>

            {showFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 sm:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-80 overflow-y-auto" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <div className="p-3 sm:p-4" data-filter-dropdown-inner onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                   <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    选择标签筛选
                  </p>

                  <div className="space-y-2 mb-4">
                    {(Object.keys(allTagConfigs) as WordTag[]).map(tag => {
                      const tagConfig = allTagConfigs[tag];
                      if (!tagConfig) return null;
                      const inputId = `tag-filter-${tag}`;
                      return (
                        <div
                          key={tag}
                          className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={filterTags.includes(tag)}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                            }}
                            onChange={(e) => {
                              handleTagToggle(tag, e);
                            }}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                          <label
                            htmlFor={inputId}
                            className="flex items-center cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <span className={`${COLOR_PRESETS.find(c => c.id === tagConfig.colorId)?.className || 'bg-gray-200'} text-sm px-2 py-1 rounded-full`}>
                              {tagConfig.name}
                            </span>
                          </label>
                        </div>
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFilterLogicToggle();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
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

        {/* 右侧：搜索和功能按钮 */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <label htmlFor="word-search" className="sr-only">搜索单词</label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="word-search"
              placeholder="搜索单词..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 w-40 h-9"
            />
          </div>

          <div className="relative">
            <Button
              data-batch-button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowBatchDropdown((prev) => !prev);
              }}
              disabled={!canBatchOperate}
              className="h-9 text-sm whitespace-nowrap bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Settings className="h-4 w-4 mr-2" />
              <span className="hidden lg:inline">批量操作</span>
              {canBatchOperate && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-white/20 text-white backdrop-blur-sm">
                  {selectedWordIds.length}
                </Badge>
              )}
            </Button>

            {showBatchDropdown && (
              <div className="absolute top-full right-0 mt-2 w-64 sm:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <div className="p-3 sm:p-4" data-batch-dropdown-inner onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                  {/* AI 出题选项 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBatchDropdown(false);
                      onAIGenerate();
                    }}
                    className="flex items-center gap-3 w-full p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">AI 出题</span>
                  </button>

                  {/* 导出选中选项 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBatchDropdown(false);
                      onExportSelected();
                    }}
                    disabled={isExportingSelected}
                    className="flex items-center gap-3 w-full p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {isExportingSelected ? (
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 text-blue-600" />
                    )}
                    <span className="text-sm">{isExportingSelected ? '导出中...' : '导出 PDF'}</span>
                  </button>
                  {/* 删除选中选项 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBatchDropdown(false);
                      onDeleteSelected();
                    }}
                    className="flex items-center gap-3 w-full p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                    <span className="text-sm">删除选中</span>
                  </button>

                  {/* 设置标签选项 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenBatchTagModal();
                    }}
                    className="flex items-center gap-3 w-full p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Tag className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">设置标签</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTagEditModal(true)}
            className="h-9 text-sm whitespace-nowrap"
          >
            <Settings className="h-4 w-4 mr-2" />
            <span className="hidden lg:inline">标签管理</span>
          </Button>
        </div>
      </div>

      {/* 移动端：简化布局 */}
      <div className="md:hidden">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSelectAll}
            className="h-9 text-xs"
          >
            <CheckSquare className="h-4 w-4" />
            <span className="sr-only">{isAllSelected ? '取消全选' : '全选'}</span>
          </Button>

          <div className="flex gap-1">
            <Button
              variant={sortBy === 'alphabet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSort('alphabet')}
              className="h-9 text-xs"
              aria-label="首字母排序"
            >
              <SortAsc className="h-4 w-4" />
            </Button>
            <Button
              variant={sortBy === 'default' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSort('default')}
              className="h-9 text-xs"
              aria-label="默认排序"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative">
            <Button
              data-filter-button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowFilterDropdown((prev) => !prev);
              }}
              className="h-9 text-xs"
            >
              <Filter className="h-4 w-4" />
              <span className="sr-only">筛选</span>
              {filterTags.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {filterTags.length}
                </Badge>
              )}
            </Button>

            {showFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-80 overflow-y-auto">
                <div className="p-3" data-filter-dropdown-inner onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    选择标签筛选
                  </p>

                  <div className="space-y-2 mb-4">
                    {(Object.keys(allTagConfigs) as WordTag[]).map(tag => {
                      const tagConfig = allTagConfigs[tag];
                      if (!tagConfig) return null;
                      const inputId = `tag-filter-${tag}`;
                      return (
                        <div
                          key={tag}
                          className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={filterTags.includes(tag)}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                            }}
                            onChange={(e) => {
                              handleTagToggle(tag, e);
                            }}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                          <label
                            htmlFor={inputId}
                            className="flex items-center cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <span className={`${COLOR_PRESETS.find(c => c.id === tagConfig.colorId)?.className || 'bg-gray-200'} text-sm px-2 py-1 rounded-full`}>
                              {tagConfig.name}
                            </span>
                          </label>
                        </div>
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFilterLogicToggle();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <label htmlFor="word-search-mobile" className="sr-only">搜索单词</label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="word-search-mobile"
              placeholder="搜索单词..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 w-full h-9"
            />
          </div>

          <div className="relative">
            <Button
              data-batch-button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowBatchDropdown((prev) => !prev);
              }}
              disabled={!canBatchOperate}
              className="h-9 px-2 text-xs whitespace-nowrap bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
              aria-label="批量操作"
            >
              <Settings className="h-4 w-4" />
              {canBatchOperate && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-white/20 text-white backdrop-blur-sm">
                  {selectedWordIds.length}
                </Badge>
              )}
            </Button>

            {showBatchDropdown && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-80 overflow-y-auto">
                <div className="p-3" data-batch-dropdown-inner onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  {/* AI 出题选项 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBatchDropdown(false);
                      onAIGenerate();
                    }}
                    className="flex items-center gap-3 w-full p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">AI 出题</span>
                  </button>

                  {/* 导出选中选项 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBatchDropdown(false);
                      onExportSelected();
                    }}
                    disabled={isExportingSelected}
                    className="flex items-center gap-3 w-full p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {isExportingSelected ? (
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 text-blue-600" />
                    )}
                    <span className="text-sm">{isExportingSelected ? '导出中...' : '导出 PDF'}</span>
                  </button>
                  {/* 删除选中选项 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBatchDropdown(false);
                      onDeleteSelected();
                    }}
                    className="flex items-center gap-3 w-full p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                    <span className="text-sm">删除选中</span>
                  </button>

                  {/* 设置标签选项 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenBatchTagModal();
                    }}
                    className="flex items-center gap-3 w-full p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Tag className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">设置标签</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTagEditModal(true)}
            className="h-9 px-2 text-xs whitespace-nowrap"
            aria-label="标签管理"
          >
            <Settings className="h-4 w-4" />
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

      {/* 批量设置标签弹窗 */}
      <BatchTagModal
        isOpen={showBatchTagModal}
        onClose={() => setShowBatchTagModal(false)}
        onSave={onSetTags}
        selectedCount={selectedWordIds.length}
        allTagConfigs={allTagConfigs}
        onTagsUpdate={onTagConfigsUpdate}
      />
    </div>
  );
};
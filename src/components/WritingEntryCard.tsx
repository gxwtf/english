'use client';

import { useState } from 'react';
import { Edit2, Trash2, X } from 'lucide-react';
import { WritingEntry } from '@/actions/writing-entries';
import { COLOR_PRESETS } from '@/constants/word-tags';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface WritingEntryCardProps {
  entry: WritingEntry;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onEdit: (entry: WritingEntry) => void;
  onDelete: (id: number) => void;
  onTagClick?: (tag: string) => void;
}

export const WritingEntryCard = ({
  entry,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onTagClick
}: WritingEntryCardProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(entry.id);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  return (
    <div className={`p-3 sm:p-4 rounded-lg border transition-all ${
      isSelected
        ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md'
    }`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(entry.id)}
          className="mt-1 flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 break-words">
                {entry.content}
              </h3>
              {entry.note && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 break-words">
                  {entry.note}
                </p>
              )}
            </div>

            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(entry)}
                className="p-2 h-8 w-8 sm:h-9 sm:w-9 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Edit2 className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className={`p-2 h-8 w-8 sm:h-9 sm:w-9 transition-colors ${
                  showDeleteConfirm
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/20'
                }`}
              >
                {showDeleteConfirm ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 标签列表 */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
            {entry.tags.map(tag => {
              const colorPreset = COLOR_PRESETS[0];
              return (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.(tag);
                  }}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
                >
                  <Badge
                    variant="secondary"
                    className={`${colorPreset?.className || 'bg-gray-200'} text-xs cursor-pointer hover:opacity-80 transition-opacity border border-current`}
                  >
                    <span>{tag}</span>
                  </Badge>
                </button>
              );
            })}
            {entry.tags.length === 0 && (
              <Badge variant="outline" className="text-gray-400 text-xs">
                无标签
              </Badge>
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-300">
            再次点击确认删除
          </p>
        </div>
      )}
    </div>
  );
};
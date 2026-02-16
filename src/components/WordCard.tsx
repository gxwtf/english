'use client';

import { useState } from 'react';
import { Check, Edit2, Trash2, X, BookOpen } from 'lucide-react';
import { Word, WordTag } from '@/types/word';
import { WORD_TAGS } from '@/constants/word-tags';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface WordCardProps {
  word: Word;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onEdit: (word: Word) => void;
  onDelete: (id: number) => void;
}

export const WordCard = ({
  word,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete
}: WordCardProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(word.id);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  return (
    <div className={`p-4 rounded-lg border transition-all ${
      isSelected
        ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md'
    }`}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(word.id)}
          className="mt-1"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {word.text}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                暂无释义数据
              </p>
            </div>

            <div className="flex gap-2 ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(word)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Edit2 className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className={`p-2 transition-colors ${
                  showDeleteConfirm
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/20'
                }`}
              >
                {showDeleteConfirm ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {word.tags.map(tag => {
              const tagConfig = WORD_TAGS[tag as WordTag];
              return (
                <Badge
                  key={tag}
                  variant="secondary"
                  className={`${tagConfig.color} text-xs`}
                >
                  {tagConfig.icon}
                  <span className="ml-1">{tagConfig.name}</span>
                </Badge>
              );
            })}
            {word.tags.length === 0 && (
              <Badge variant="outline" className="text-gray-400 text-xs">
                <BookOpen className="h-3 w-3 mr-1" />
                无标签
              </Badge>
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-300">
            再次点击确认删除单词
          </p>
        </div>
      )}
    </div>
  );
};
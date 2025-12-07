// components/WordItem.tsx
"use client";

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle } from 'lucide-react';
import { Word, WordTag, TagConfig } from '@/types/word';

export interface WordItemProps {
  word: Word;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onDelete: (id: number) => void;
  tagsConfig: Record<WordTag, TagConfig>;
}

export const WordItem: React.FC<WordItemProps> = ({
  word,
  isSelected,
  onToggleSelect,
  onDelete,
  tagsConfig
}) => {
  return (
    <div className={`
      flex items-center justify-between p-4 rounded-lg border transition-all duration-200
      ${isSelected
        ? 'bg-blue-50 border-blue-300 shadow-sm'
        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }
    `}>
      <div className="flex items-center gap-4 flex-1">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(word.id)}
          className="h-5 w-5 data-[state=checked]:bg-blue-600"
        />

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-gray-800">{word.text}</span>
            {isSelected && (
              <CheckCircle className="h-4 w-4 text-blue-600" />
            )}
          </div>

          <div className="flex gap-2 mt-2">
            {word.tags.length > 0 ? (
              word.tags.map(tag => {
                const tagConfig = tagsConfig[tag];
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={`px-2 py-1 text-xs font-medium ${tagConfig.color}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {tagConfig.icon}
                      {tagConfig.name}
                    </div>
                  </Badge>
                );
              })
            ) : (
              <span className="text-xs text-gray-400 italic">无标签</span>
            )}
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(word.id)}
        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
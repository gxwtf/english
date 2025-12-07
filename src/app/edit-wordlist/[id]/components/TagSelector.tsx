// components/TagSelector.tsx
"use client";

import React from 'react';
import { Word, WordTag, TagConfig } from '@/types/word';

export interface TagSelectorProps {
  tagKey: WordTag;
  isSelected: boolean;
  onToggle: (tag: WordTag) => void;
  tagsConfig: Record<WordTag, TagConfig>;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  tagKey,
  isSelected,
  onToggle,
  tagsConfig
}) => {
  const tagConfig = tagsConfig[tagKey];

  return (
    <button
      type="button"
      onClick={() => onToggle(tagKey)}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200
        ${isSelected
          ? `${tagConfig.color} border-blue-300`
          : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800'
        }
      `}
    >
      <div className={`p-1 rounded-md ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`}>
        {tagConfig.icon}
      </div>
      <span className="text-sm font-medium">{tagConfig.name}</span>
    </button>
  );
};
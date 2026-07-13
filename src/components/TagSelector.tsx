'use client';

import { Settings } from 'lucide-react';
import { WordTag, TagConfig } from '@/types/word';
import { COLOR_PRESETS } from '@/constants/word-tags';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TagEditModal } from '@/components/TagEditModal';
import { useState } from 'react';

interface TagSelectorProps {
  allTagConfigs: Record<WordTag, TagConfig>;
  selectedTags: WordTag[];
  onTagsChange: (tags: WordTag[]) => void;
  onTagsUpdate?: (newTagConfigs: Record<WordTag, TagConfig>) => void;
  compact?: boolean;
}

export const TagSelector = ({
  allTagConfigs,
  selectedTags,
  onTagsChange,
  onTagsUpdate,
  compact = false,
}: TagSelectorProps) => {
  const [showTagEditModal, setShowTagEditModal] = useState(false);

  const toggleTag = (tag: WordTag) => {
    onTagsChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag]
    );
  };

  return (
    <>
      <div className="space-y-3">
        {!compact && (
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              标签
            </h4>
            {onTagsUpdate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTagEditModal(true)}
                className="h-7 px-2 text-xs whitespace-nowrap"
              >
                <Settings className="h-3 w-3 mr-1" />
                标签管理
              </Button>
            )}
          </div>
        )}

        {Object.keys(allTagConfigs).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(allTagConfigs) as WordTag[]).map((tag) => {
              const tagConfig = allTagConfigs[tag];
              if (!tagConfig) return null;
              const isSelected = selectedTags.includes(tag);
              const colorPreset = COLOR_PRESETS.find((c) => c.id === tagConfig.colorId);

              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className={`
                    ${
                      isSelected
                        ? colorPreset
                          ? `${colorPreset.className} dark:bg-gray-800 dark:text-gray-300 ring-2 ring-blue-500 ring-offset-1 shadow-md`
                          : 'bg-blue-100 text-blue-800 border-blue-500 ring-2 ring-blue-500 ring-offset-1'
                        : colorPreset
                          ? `${colorPreset.className} dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-opacity-80`
                          : 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-opacity-80'
                    }
                    cursor-pointer transition-all hover:scale-105 hover:opacity-90 select-none
                  `}
                  onClick={() => toggleTag(tag)}
                >
                  {tagConfig.name}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            暂无标签
            {onTagsUpdate && '，可点击"标签管理"添加'}
          </p>
        )}
      </div>

      {showTagEditModal && (
        <TagEditModal
          isOpen={showTagEditModal}
          onClose={() => setShowTagEditModal(false)}
          onTagsUpdate={(newTagConfigs) => {
            setShowTagEditModal(false);
            onTagsUpdate?.(newTagConfigs);
          }}
          currentTags={allTagConfigs}
        />
      )}
    </>
  );
};

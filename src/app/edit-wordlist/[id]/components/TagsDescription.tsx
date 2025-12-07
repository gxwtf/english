// components/TagsDescription.tsx
"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TagConfig, WordTag } from '@/types/word';

interface TagsDescriptionProps {
  tags: Record<WordTag, TagConfig>;
}

export const TagsDescription: React.FC<TagsDescriptionProps> = ({ tags }) => {
  return (
    <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg">
      <h4 className="font-medium text-gray-800 mb-3">标签说明</h4>
      <div className="space-y-3">
        {Object.values(tags).map((tag) => (
          <div key={tag.id} className="flex items-start gap-3">
            <Badge variant="outline" className={`px-3 py-1 ${tag.color}`}>
              <div className="flex items-center gap-2">
                {tag.icon}
                {tag.name}
              </div>
            </Badge>
            <span className="text-sm text-gray-600 flex-1">
              {tag.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
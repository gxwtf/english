// components/EmptyState.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { XCircle, Plus } from 'lucide-react';

interface EmptyStateProps {
  onAddClick: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onAddClick }) => {
  return (
    <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50">
      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <XCircle className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-gray-500 mb-1 font-medium">暂无单词</p>
      <p className="text-gray-400 text-sm mb-4">点击"添加单词"按钮开始创建单词</p>
      <Button
        onClick={onAddClick}
        variant="outline"
        className="border-gray-300 hover:bg-gray-50"
      >
        <Plus className="h-4 w-4 mr-2" />
        添加第一个单词
      </Button>
    </div>
  );
};
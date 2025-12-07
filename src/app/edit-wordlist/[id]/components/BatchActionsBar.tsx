"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Trash2, CheckCircle, Beaker } from 'lucide-react';

interface BatchActionsBarProps {
  selectedCount: number;
  selectAll: boolean;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onTest?: () => void;
}

export const BatchActionsBar: React.FC<BatchActionsBarProps> = ({
  selectedCount,
  selectAll,
  onSelectAll,
  onDeleteSelected,
  onTest
}) => {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={selectAll}
            onCheckedChange={onSelectAll}
            className="h-5 w-5 data-[state=checked]:bg-blue-600"
          />
          <Label
            htmlFor="select-all"
            className="text-sm font-medium text-gray-700 cursor-pointer select-none"
          >
            {selectAll ? '取消全选' : '全选'}
          </Label>
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
            <CheckCircle className="h-4 w-4" />
            已选择 {selectedCount} 个单词
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {onTest && (
          <Button
            onClick={onTest}
            variant="outline"
            size="sm"
            className="gap-2 border-gray-300 hover:bg-gray-100"
          >
            <Beaker className="h-4 w-4" />
            测试
          </Button>
        )}
        <Button
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          variant="destructive"
          size="sm"
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          删除选中
        </Button>
      </div>
    </div>
  );
};
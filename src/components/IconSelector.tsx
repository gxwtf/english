'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ICON_OPTIONS } from '@/constants/word-tags';

interface IconSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onIconSelect: (icon: string) => void;
  currentIcon?: string;
}

export const IconSelector = ({ isOpen, onClose, onIconSelect, currentIcon }: IconSelectorProps) => {
  const [selectedIcon, setSelectedIcon] = useState(currentIcon || '●');

  const handleIconSelect = (icon: string) => {
    setSelectedIcon(icon);
  };

  const handleConfirm = () => {
    onIconSelect(selectedIcon);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            选择图标
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 图标网格 */}
        <div className="grid grid-cols-8 gap-3 mb-4">
          {ICON_OPTIONS.map((icon) => (
            <button
              key={icon}
              className={`w-10 h-10 rounded border-2 flex items-center justify-center text-lg transition-all ${
                selectedIcon === icon
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
              onClick={() => handleIconSelect(icon)}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* 当前选择 */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">当前选择：</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{selectedIcon}</span>
            <span className="text-gray-900 dark:text-white font-medium">{selectedIcon}</span>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleConfirm}>
            确认
          </Button>
        </div>
      </div>
    </div>
  );
};
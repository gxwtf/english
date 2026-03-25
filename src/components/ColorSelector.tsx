'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { COLOR_PRESETS } from '@/constants/word-tags';
import type { ColorConfig } from '@/types/word';

interface ColorSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onColorSelect: (color: ColorConfig) => void;
  currentColorId?: string;
}

export const ColorSelector = ({ isOpen, onClose, onColorSelect, currentColorId }: ColorSelectorProps) => {
  const [selectedColorId, setSelectedColorId] = useState(currentColorId || 'blue');

  const handleColorSelect = (color: ColorConfig) => {
    setSelectedColorId(color.id);
  };

  const handleConfirm = () => {
    const selectedColor = COLOR_PRESETS.find(color => color.id === selectedColorId);
    if (selectedColor) {
      onColorSelect(selectedColor);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            选择颜色
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 颜色网格 */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color.id}
              className={`relative h-16 rounded-lg border-2 transition-all duration-200 transform hover:scale-105 hover:shadow-lg ${
                selectedColorId === color.id
                  ? 'ring-2 ring-offset-2 ring-blue-500 border-blue-500'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
              onClick={() => handleColorSelect(color)}
            >
              {/* 悬停效果 */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>

              {/* 颜色预览 */}
              <div className={`relative h-full w-full flex flex-col items-center justify-center rounded-lg ${color.className}`}>
                <div className="w-6 h-6 rounded-full bg-current opacity-80"></div>
                <span className="text-xs mt-1 opacity-80">{color.name}</span>
              </div>

              {/* 选中指示器 */}
              {selectedColorId === color.id && (
                <div className="absolute -top-1 -right-1">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* 当前选择 */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">当前选择：</p>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${COLOR_PRESETS.find(c => c.id === selectedColorId)?.className || 'bg-gray-200'}`}>
              <div className="w-4 h-4 rounded-full bg-current opacity-80"></div>
            </div>
            <span className="text-gray-900 dark:text-white font-medium">
              {COLOR_PRESETS.find(c => c.id === selectedColorId)?.name || '未选择'}
            </span>
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
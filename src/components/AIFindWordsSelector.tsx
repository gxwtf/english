'use client';

import { useState } from 'react';
import { Sparkles, ArrowUpDown, GraduationCap, Feather, Globe, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { WordDifficulty } from '@/actions/writing-entries';

interface AIFindWordsSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (difficulty: WordDifficulty) => void;
}

const difficultyOptions: { id: WordDifficulty; title: string; description: string; icon: typeof Sparkles; colorClasses: { selectedBorder: string; selectedBg: string; iconBg: string; iconText: string; iconBgSelected: string } }[] = [
  {
    id: 'replace',
    title: '常用单词替换词',
    description: '用高级词汇替换基础词汇，提升作文表达丰富度',
    icon: ArrowUpDown,
    colorClasses: {
      selectedBorder: 'border-blue-500 dark:border-blue-400',
      selectedBg: 'bg-blue-50 dark:bg-blue-900/20',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconText: 'text-blue-600 dark:text-blue-400',
      iconBgSelected: 'bg-blue-500 dark:bg-blue-600',
    },
  },
  {
    id: 'gaokao',
    title: '高考核心词汇',
    description: '高考3500词中的高频重点词汇，夯实基础应对考试',
    icon: GraduationCap,
    colorClasses: {
      selectedBorder: 'border-green-500 dark:border-green-400',
      selectedBg: 'bg-green-50 dark:bg-green-900/20',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconText: 'text-green-600 dark:text-green-400',
      iconBgSelected: 'bg-green-500 dark:bg-green-600',
    },
  },
  {
    id: 'writing',
    title: '写作高级表达',
    description: '适合书面表达的高级句型和词汇搭配，提升作文档次',
    icon: Feather,
    colorClasses: {
      selectedBorder: 'border-purple-500 dark:border-purple-400',
      selectedBg: 'bg-purple-50 dark:bg-purple-900/20',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconText: 'text-purple-600 dark:text-purple-400',
      iconBgSelected: 'bg-purple-500 dark:bg-purple-600',
    },
  },
  {
    id: 'extensive',
    title: '外刊拓展词汇',
    description: '课标外但常出现于外刊的词汇，拓展阅读能力',
    icon: Globe,
    colorClasses: {
      selectedBorder: 'border-orange-500 dark:border-orange-400',
      selectedBg: 'bg-orange-50 dark:bg-orange-900/20',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconText: 'text-orange-600 dark:text-orange-400',
      iconBgSelected: 'bg-orange-500 dark:bg-orange-600',
    },
  },
];

export const AIFindWordsSelector = ({ isOpen, onClose, onSelect }: AIFindWordsSelectorProps) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<WordDifficulty | null>(null);

  const handleStart = () => {
    if (!selectedDifficulty) return;
    onSelect(selectedDifficulty);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                AI 找词
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                选择目标单词难度，AI 将从作文中提取好词
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-2 h-9 w-9 shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-3">
            {difficultyOptions.map((option) => {
              const Icon = option.icon;
              const colors = option.colorClasses;
              const isSelected = selectedDifficulty === option.id;
              return (
                <Button
                  key={option.id}
                  onClick={() => setSelectedDifficulty(option.id)}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`group flex flex-col items-start gap-2 p-4 rounded-xl h-auto w-full text-left ${
                    isSelected
                      ? `${colors.selectedBorder} ${colors.selectedBg} shadow-lg`
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:shadow-lg'
                  }`}
                >
                  <div className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-lg transition-all duration-200 ${
                    isSelected
                      ? `${colors.iconBgSelected} text-white shadow-sm`
                      : `${colors.iconBg} ${colors.iconText} group-hover:brightness-90`
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm">{option.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.description}</div>
                  </div>
                </Button>
              );
            })}
          </div>

          <Button
            onClick={handleStart}
            disabled={!selectedDifficulty}
            className={`mt-6 w-full py-3 font-semibold rounded-xl shadow-md hover:shadow-lg h-auto ${
              selectedDifficulty
                ? 'bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            {selectedDifficulty
              ? `开始找词（${difficultyOptions.find(d => d.id === selectedDifficulty)?.title}）`
              : '请选择目标难度'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
'use client';

import { QuestionQueueItem } from '@/types/word';
import { Sparkles } from 'lucide-react';
import { QuestionList } from '@/components/QuestionDisplay';

interface QuestionPanelProps {
  queue: QuestionQueueItem[];
  isOpen: boolean;
  onClose: () => void;
}

export const QuestionPanel = ({
  queue,
  isOpen,
  onClose,
}: QuestionPanelProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI 出题队列</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            关闭
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <QuestionList queue={queue} />
        </div>
      </div>
    </div>
  );
};

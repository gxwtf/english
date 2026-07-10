'use client';

import { QuestionQueueItem } from '@/types/word';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI 出题队列
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 -mb-6 px-6 pb-6">
          <QuestionList queue={queue} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

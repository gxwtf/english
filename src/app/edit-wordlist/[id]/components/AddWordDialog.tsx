// components/AddWordDialog.tsx
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { TagSelector } from './TagSelector';
import { WORD_TAGS } from '@/constants/word-tags';
import { Word, WordTag } from '@/types/word';

export interface AddWordDialogProps {
  isOpen: boolean;
  onAddWord: (word: Omit<Word, 'id'>) => void;
  onCancel: () => void;
  onDuplicateCheck: (wordText: string) => boolean;
}

export const AddWordDialog: React.FC<AddWordDialogProps> = ({
  isOpen,
  onAddWord,
  onCancel,
  onDuplicateCheck
}) => {
  const [newWord, setNewWord] = useState('');
  const [selectedTags, setSelectedTags] = useState<Record<WordTag, boolean>>({
    COMMON: true,
    MULTIPLE: false,
    FORMS: false
  });
  const [duplicateError, setDuplicateError] = useState('');

  if (!isOpen) return null;

  const handleAddWord = () => {
    if (!newWord.trim()) return;

    const wordText = newWord.trim();
    
    if (onDuplicateCheck(wordText)) {
      setDuplicateError(`单词 "${wordText}" 已存在`);
      return;
    }

    const newWordItem = {
      text: wordText,
      tags: (Object.keys(selectedTags) as WordTag[]).filter(tag => selectedTags[tag])
    };

    onAddWord(newWordItem);
    
    setNewWord('');
    setSelectedTags({
      COMMON: true,
      MULTIPLE: false,
      FORMS: false
    });
    setDuplicateError('');
  };

  const handleTagToggle = (tag: WordTag) => {
    setSelectedTags(prev => ({
      ...prev,
      [tag]: !prev[tag]
    }));
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full transform animate-scaleIn">
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  添加新单词
                </h3>
                <p className="text-sm text-gray-600">
                  输入单词并选择知识点标签
                </p>
              </div>
              <button
                onClick={onCancel}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dialog-new-word" className="text-sm font-medium text-gray-700">
                  单词
                </Label>
                <div>
                  <Input
                    id="dialog-new-word"
                    placeholder="请输入一个英语单词..."
                    value={newWord}
                    onChange={(e) => {
                      setNewWord(e.target.value);
                      setDuplicateError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                    className="w-full"
                  />
                  {duplicateError && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {duplicateError}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  选择知识点标签
                </Label>
                <p className="text-xs text-gray-500 mb-2">
                  请认真选择以提高背诵效率
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(WORD_TAGS) as WordTag[]).map((tagKey) => (
                    <TagSelector
                      key={tagKey}
                      tagKey={tagKey}
                      isSelected={selectedTags[tagKey]}
                      onToggle={handleTagToggle}
                      tagsConfig={WORD_TAGS}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-gray-300 hover:bg-gray-100"
            >
              取消
            </Button>
            <Button
              onClick={handleAddWord}
              disabled={!newWord.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              添加单词
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
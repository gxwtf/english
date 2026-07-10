'use client';

import { useState } from 'react';
import { X, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RelatedWord, RelatedWordType } from '@/types/word';

interface RelatedWordSelectorProps {
  currentWordText?: string;                       // 当前编辑的单词文本（排除自己）
  selectedRelatedWords: RelatedWord[];            // 已选择的关联单词
  onSelectChange: (selected: RelatedWord[]) => void; // 选择变化时的回调
  queryWord: (word: string) => Promise<{ word: string } | null>; // 查询词典的函数
}

const RELATION_TYPE_LABELS: Record<RelatedWordType, string> = {
  different_form: '不同形式',
  easily_confused: '容易混淆',
};

export const RelatedWordSelector = ({
  currentWordText,
  selectedRelatedWords,
  onSelectChange,
  queryWord,
}: RelatedWordSelectorProps) => {
  const [newWordText, setNewWordText] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  // 验证单词是否在词典中
  const verifyWord = async (word: string): Promise<boolean> => {
    try {
      const result = await queryWord(word);
      return result !== null;
    } catch (err) {
      return false;
    }
  };

  // 添加关联单词
  const handleAddRelated = async (text: string, type: RelatedWordType = 'easily_confused') => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // 检查是否已存在
    if (selectedRelatedWords.some(rw => rw.text === trimmed)) {
      return;
    }

    // 验证单词是否在词典中
    setIsVerifying(true);
    const isValid = await verifyWord(trimmed);
    setIsVerifying(false);

    if (!isValid) {
      setVerificationError('该单词不在词典中，请检查拼写');
      return;
    }

    const newRelated: RelatedWord = {
      text: trimmed,
      type,
    };
    onSelectChange([...selectedRelatedWords, newRelated]);
    setNewWordText('');
    setVerificationError('');
  };

  // 移除关联单词
  const handleRemoveRelated = (wordText: string) => {
    onSelectChange(selectedRelatedWords.filter(rw => rw.text !== wordText));
  };

  // 更新关联类型
  const handleUpdateType = (wordText: string, type: RelatedWordType) => {
    onSelectChange(
      selectedRelatedWords.map(rw =>
        rw.text === wordText ? { ...rw, type } : rw
      )
    );
  };

  // 处理回车添加
  const handleKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newWordText.trim()) {
      e.preventDefault();
      await handleAddRelated(newWordText);
    }
  };

  // 处理点击"添加"按钮
  const handleAddButtonClick = async () => {
    if (newWordText.trim()) {
      await handleAddRelated(newWordText);
    }
  };

  // 切换关联类型
  const toggleType = (wordText: string) => {
    const word = selectedRelatedWords.find(rw => rw.text === wordText);
    if (word) {
      const newType: RelatedWordType = word.type === 'easily_confused'
        ? 'different_form'
        : 'easily_confused';
      handleUpdateType(wordText, newType);
    }
  };

  return (
    <div className="space-y-4">
      {/* 头部标题 */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          关联单词
        </h4>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          已选择 {selectedRelatedWords.length} 个
        </span>
      </div>

      {/* 已选择的关联单词列表 */}
      {selectedRelatedWords.length > 0 && (
        <div className="space-y-2">
          {selectedRelatedWords.map((related) => (
            <div
              key={related.text}
              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                {related.text}
              </span>

              {/* 关联类型按钮 */}
              <button
                onClick={() => toggleType(related.text)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  related.type === 'different_form'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                }`}
                title={related.type === 'different_form' ? '不同形式' : '容易混淆'}
              >
                {related.type === 'different_form' ? '不同形式' : '容易混淆'}
              </button>

              {/* 移除按钮 */}
              <button
                onClick={() => handleRemoveRelated(related.text)}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 输入框添加关联单词 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Label htmlFor="related-word-input" className="text-sm">
            输入关联单词
          </Label>
          {isVerifying && (
            <span className="text-xs text-gray-500 dark:text-gray-400">验证中...</span>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="related-word-input"
              placeholder="输入单词后回车添加..."
              value={newWordText}
              onChange={(e) => {
                setNewWordText(e.target.value);
                setVerificationError('');
              }}
              onKeyDown={handleKeyPress}
              className={verificationError ? 'border-red-500' : ''}
              disabled={isVerifying}
            />
          </div>
          <button
            type="button"
            onClick={handleAddButtonClick}
            disabled={isVerifying || !newWordText.trim()}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-1" />
            添加
          </button>
        </div>
        {verificationError && (
          <p className="text-xs text-red-500 mt-1">{verificationError}</p>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          提示：按回车键或点击"添加"按钮添加单词，点击已添加的关联词可切换类型
        </p>
      </div>

      {/* 提示信息 */}
      {selectedRelatedWords.length === 0 && !newWordText && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            输入一个在词典中的单词作为关联词，帮助记忆形近词或易混词
          </p>
        </div>
      )}
    </div>
  );
};

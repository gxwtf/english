'use client';

import { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  Sparkles,
  BookOpen,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AIExtractedWord } from '@/actions/writing-entries';
import { Meaning, DictionaryEntry } from '@/types/dict';
import { saveWord } from '@/actions/words';

interface AIFindWordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  words: AIExtractedWord[];
  isLoading: boolean;
  queryWord?: (word: string) => Promise<DictionaryEntry | null>;
  onWordAdded?: () => void;
}

export const AIFindWordsModal = ({
  isOpen,
  onClose,
  words,
  isLoading,
  queryWord,
  onWordAdded,
}: AIFindWordsModalProps) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'ai' | 'full' | null>(null);
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const [copied, setCopied] = useState(false);
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0, currentWord: '' });

  useEffect(() => {
    if (isOpen) {
      setSelectedIndices(words.map((_, i) => i));
      setImporting(false);
      setImportMode(null);
      setImportResults({ success: 0, failed: 0 });
      setCopied(false);
    }
  }, [isOpen, words]);

  const toggleSelectAll = () => {
    if (selectedIndices.length === words.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(words.map((_, i) => i));
    }
  };

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const selectedWords = words.filter((_, i) => selectedIndices.includes(i));

  const formatMeanings = (word: AIExtractedWord): Meaning[] => {
    return [{ content: word.meaning, type: word.type, sentence: word.sentence }];
  };

  const handleImportAI = async () => {
    if (selectedWords.length === 0) return;
    setImporting(true);
    setImportMode('ai');
    setCurrentProgress({ current: 0, total: selectedWords.length, currentWord: '' });
    let success = 0;
    let failed = 0;

    for (let i = 0; i < selectedWords.length; i++) {
      const word = selectedWords[i];
      setCurrentProgress({ current: i + 1, total: selectedWords.length, currentWord: word.word });
      try {
        const meanings = formatMeanings(word);
        await saveWord({
          text: word.word,
          meanings,
          tags: [],
          relatedWords: [],
        });
        success++;
      } catch {
        failed++;
      }
    }

    setImportResults({ success, failed });
    setImporting(false);
    setCurrentProgress({ current: 0, total: 0, currentWord: '' });
    await onWordAdded?.();
  };

  const handleImportFull = async () => {
    if (selectedWords.length === 0 || !queryWord) return;
    setImporting(true);
    setImportMode('full');
    setCurrentProgress({ current: 0, total: selectedWords.length, currentWord: '' });
    let success = 0;
    let failed = 0;

    for (let i = 0; i < selectedWords.length; i++) {
      const word = selectedWords[i];
      setCurrentProgress({ current: i + 1, total: selectedWords.length, currentWord: word.word });
      try {
        const dictEntry = await queryWord(word.word);
        if (!dictEntry || dictEntry.meaning.length === 0) {
          failed++;
          continue;
        }
        if (dictEntry.word.toLowerCase() !== word.word.toLowerCase()) {
          failed++;
          continue;
        }
        await saveWord({
          text: word.word,
          meanings: dictEntry.meaning,
          tags: [],
          relatedWords: [],
        });
        success++;
      } catch {
        failed++;
      }
    }

    setImportResults({ success, failed });
    setImporting(false);
    setCurrentProgress({ current: 0, total: 0, currentWord: '' });
    await onWordAdded?.();
  };

  const handleCopy = async () => {
    const text = selectedWords
      .map((word) => `${word.word} | ${word.type} | ${word.meaning}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDone = importMode !== null && !importing;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                AI 找词结果
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isLoading ? '正在分析作文...' : `共找到 ${words.length} 个好词，已选择 ${selectedIndices.length} 个`}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-2 h-9 w-9 shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-auto p-6 space-y-4 max-h-[calc(90vh-200px)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">AI 正在分析作文内容...</p>
            </div>
          ) : words.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">未找到合适的单词</p>
            </div>
          ) : (
            <>
              {importing ? (
                <div className="rounded-xl p-4 border bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {importMode === 'ai' ? '正在导入AI释义...' : '正在查询并导入全部释义...'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    请耐心等待，正在处理单词 <span className="font-medium text-purple-600 dark:text-purple-400">{currentProgress.currentWord}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-500 dark:text-gray-400">
                      进度: {currentProgress.current} / {currentProgress.total}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {currentProgress.total > 0 ? Math.round((currentProgress.current / currentProgress.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{
                        width: `${currentProgress.total > 0 ? (currentProgress.current / currentProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ) : isDone ? (
                <div className={`rounded-xl p-4 border ${
                  importResults.failed > 0
                    ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700'
                    : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    {importResults.failed > 0 ? (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                        部分导入成功
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                        全部导入成功
                      </Badge>
                    )}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {importMode === 'ai' ? 'AI推荐释义' : '全部释义'}导入结果
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓ 成功 {importResults.success}
                    </span>
                    {importResults.failed > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        ✗ 失败 {importResults.failed}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <Checkbox checked={selectedIndices.length === words.length} onCheckedChange={toggleSelectAll} />
                  <span>{selectedIndices.length === words.length ? '取消全选' : '全选'}</span>
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedIndices.length} / {words.length}
                </span>
              </div>

              <ScrollArea className="h-80">
                <div className="space-y-3 pr-2">
                  {words.map((word, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border ${
                        selectedIndices.includes(index)
                          ? 'border-purple-300 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-900/20'
                          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedIndices.includes(index)}
                          onCheckedChange={() => toggleSelect(index)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-lg text-gray-900 dark:text-white">
                              {word.word}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {word.type}
                            </Badge>
                            {word.replaceWord && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                替换: {word.replaceWord}
                              </Badge>
                            )}
                            {word.difficultyTag && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                                {word.difficultyTag}
                              </Badge>
                            )}
                            {word.sourceDomain && (
                              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                                {word.sourceDomain}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {word.meaning}
                          </p>
                          {word.sentence && (
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2 italic">
                              例句: {word.sentence}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 gap-3">
          {isDone ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {importResults.success} 个单词已导入单词本
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              已选择 {selectedIndices.length} 个单词
            </div>
          )}
          <div className="flex gap-2">
            {!isDone && (
              <>
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  disabled={selectedWords.length === 0}
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <><Check className="h-4 w-4" /> 已复制</>
                  ) : (
                    <><ClipboardList className="h-4 w-4" /> 复制列表</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleImportAI}
                  disabled={selectedWords.length === 0 || importing}
                  className="flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/20"
                >
                  <Sparkles className="h-4 w-4" />
                  {importing ? '导入中...' : '导入AI释义'}
                </Button>
                <Button
                  onClick={handleImportFull}
                  disabled={selectedWords.length === 0 || importing || !queryWord}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600"
                >
                  <BookOpen className="h-4 w-4" />
                  {importing ? '查询中...' : '导入全部释义'}
                </Button>
              </>
            )}
            {isDone && (
              <Button onClick={onClose} className="bg-purple-500 hover:bg-purple-600">
                完成
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
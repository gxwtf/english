'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertCircle,
  Plus,
  ListPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Edit3,
  RotateCw,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WordModal } from '@/components/WordModal';
import { DictionaryEntry, Meaning } from '@/types/dict';
import { Word, WordTag, TagConfig, RelatedWord } from '@/types/word';
import { saveWord as saveWordAction } from '@/actions/words';

interface BatchAddWordProps {
  isOpen: boolean;
  onClose: () => void;
  queryWord: (word: string) => Promise<DictionaryEntry | null>;
  allTagConfigs: Record<WordTag, TagConfig>;
  onTagsUpdate?: (newTagConfigs: Record<WordTag, TagConfig>) => void;
  allWords?: Word[];
  onWordAdded?: () => void;
}

type WordStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped';

interface BatchWordItem {
  text: string;
  status: WordStatus;
  meanings?: Meaning[];
  selectedMeanings?: Meaning[];
  error?: string;
}

export const BatchAddWord = ({
  isOpen,
  onClose,
  queryWord,
  allTagConfigs,
  onTagsUpdate,
  allWords = [],
  onWordAdded,
}: BatchAddWordProps) => {
  const [inputText, setInputText] = useState('');
  const [skipDef, setSkipDef] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [items, setItems] = useState<BatchWordItem[]>([]);
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setInputText('');
      setSkipDef(false);
      setIsProcessing(false);
      setHasStarted(false);
      setItems([]);
      setEditingWordIndex(null);
      cancelRef.current = false;
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // 解析输入：按行拆分、去空白、去重（不区分大小写）
  const parseWords = (text: string): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        result.push(trimmed);
      }
    }
    return result;
  };

  const processWord = async (
    wordText: string,
    skipDefMeanings: boolean,
  ): Promise<{ status: WordStatus; meanings?: Meaning[]; error?: string }> => {
    try {
      const dictEntry = await queryWord(wordText);

      if (!dictEntry || dictEntry.meaning.length === 0) {
        return { status: 'failed', error: '词典中未找到该单词' };
      }

      // 校验词典返回的单词是否与请求一致，防止缓存导致释义错乱
      if (dictEntry.word.toLowerCase() !== wordText.trim().toLowerCase()) {
        console.error(
          `[BatchAddWord] 词典结果不匹配: 请求="${wordText}", 返回="${dictEntry.word}"，跳过保存`
        );
        return {
          status: 'failed',
          error: `词典返回了 "${dictEntry.word}" 的释义，与请求的 "${wordText}" 不匹配`,
        };
      }

      const meanings = skipDefMeanings
        ? dictEntry.meaning.filter((m) => m.type !== 'def.')
        : dictEntry.meaning;

      if (meanings.length === 0) {
        return {
          status: 'skipped',
          error: '过滤后无可用释义',
          meanings: dictEntry.meaning,
        };
      }

      await saveWordAction({
        text: wordText,
        meanings,
        tags: [],
        relatedWords: [],
      });

      return { status: 'success', meanings };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '保存失败';
      return { status: 'failed', error: errorMsg };
    }
  };

  const handleBatchAdd = async () => {
    const words = parseWords(inputText);
    if (words.length === 0) return;

    setIsProcessing(true);
    setHasStarted(true);
    cancelRef.current = false;

    const initialItems: BatchWordItem[] = words.map((word) => ({
      text: word,
      status: 'pending' as const,
    }));
    setItems(initialItems);

    for (let i = 0; i < words.length; i++) {
      if (cancelRef.current) break;

      const wordText = words[i];

      setItems((prev) => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: 'processing' };
        return updated;
      });

      const result = await processWord(wordText, skipDef);

      setItems((prev) => {
        const updated = [...prev];
        updated[i] = {
          ...updated[i],
          status: result.status,
          meanings: result.meanings ?? updated[i].meanings,
          selectedMeanings:
            result.status === 'success' ? result.meanings : updated[i].selectedMeanings,
          error: result.error,
        };
        return updated;
      });
    }

    setIsProcessing(false);
    await onWordAdded?.();
  };

  const handleRetryFailed = async () => {
    const failedIndices = items
      .map((item, index) =>
        item.status === 'failed' || item.status === 'skipped' ? index : -1,
      )
      .filter((index) => index !== -1);

    if (failedIndices.length === 0) return;

    setIsProcessing(true);
    cancelRef.current = false;

    for (const index of failedIndices) {
      if (cancelRef.current) break;

      const wordText = items[index].text;

      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'processing', error: undefined };
        return updated;
      });

      const result = await processWord(wordText, skipDef);

      setItems((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: result.status,
          meanings: result.meanings ?? updated[index].meanings,
          selectedMeanings:
            result.status === 'success' ? result.meanings : updated[index].selectedMeanings,
          error: result.error,
        };
        return updated;
      });
    }

    setIsProcessing(false);
    await onWordAdded?.();
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const handleEditWord = (index: number) => {
    setEditingWordIndex(index);
  };

  const handleSaveWord = async (wordData: {
    text: string;
    meanings: Meaning[];
    tags: WordTag[];
    relatedWords?: RelatedWord[];
  }) => {
    try {
      await saveWordAction(wordData);

      if (editingWordIndex !== null) {
        setItems((prev) => {
          const updated = [...prev];
          updated[editingWordIndex] = {
            ...updated[editingWordIndex],
            text: wordData.text,
            status: 'success',
            meanings: wordData.meanings,
            selectedMeanings: wordData.meanings,
            error: undefined,
          };
          return updated;
        });
      }

      await onWordAdded?.();
    } catch (err) {
      console.error('保存失败:', err);
    } finally {
      setEditingWordIndex(null);
    }
  };

  const handleReset = () => {
    setInputText('');
    setHasStarted(false);
    setItems([]);
    cancelRef.current = false;
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  if (!isOpen) return null;

  const successCount = items.filter((i) => i.status === 'success').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const skippedCount = items.filter((i) => i.status === 'skipped').length;
  const processedCount = successCount + failedCount + skippedCount;
  const totalCount = items.length;
  const isDone = hasStarted && !isProcessing && processedCount > 0;
  const hasFailed = failedCount > 0 || skippedCount > 0;
  const editingWord = editingWordIndex !== null ? items[editingWordIndex] : null;

  const statusIcon: Record<WordStatus, React.ReactNode> = {
    pending: <div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />,
    processing: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    skipped: <AlertCircle className="h-4 w-4 text-amber-500" />,
  };

  const statusBg: Record<WordStatus, string> = {
    pending: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    processing: 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-700',
    success: 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-700',
    failed: 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-700',
    skipped: 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700',
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-3 sm:p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 bg-emerald-50 dark:bg-gray-700">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 shrink-0">
                <ListPlus className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  批量添加单词
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  每行输入一个单词，自动查询并添加
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50 shrink-0"
              disabled={isProcessing}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-5 space-y-4">
            {/* Input view */}
            {!hasStarted && (
              <>
                <div>
                  <label
                    htmlFor="batch-word-input"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    单词列表（每行一个）
                  </label>
                  <Textarea
                    id="batch-word-input"
                    ref={textareaRef}
                    placeholder={'apple\nbanana\norange'}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="min-h-48 font-mono"
                    disabled={isProcessing}
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    共 {parseWords(inputText).length} 个单词（重复单词将自动去重）
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      跳过 def. 词性的释义
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {skipDef
                        ? '将仅添加有明确词性（n./v./adj. 等）的释义'
                        : '默认添加单词的所有释义（包括 def.）'}
                    </p>
                  </div>
                  <Switch
                    checked={skipDef}
                    onCheckedChange={setSkipDef}
                    disabled={isProcessing}
                  />
                </div>
              </>
            )}

            {/* Processing / Results view */}
            {hasStarted && (
              <>
                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                      {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isProcessing ? '正在添加...' : '处理完成'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {processedCount} / {totalCount}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${totalCount > 0 ? (processedCount / totalCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Summary */}
                {isDone && (
                  <div
                    className={`rounded-xl p-4 border ${
                      hasFailed
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700'
                        : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {hasFailed ? (
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      )}
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {hasFailed ? '部分单词未添加成功' : '全部添加成功！'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ✓ 成功 {successCount}
                      </span>
                      {failedCount > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          ✗ 失败 {failedCount}
                        </span>
                      )}
                      {skippedCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          ⚠ 跳过 {skippedCount}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Items list */}
                <ScrollArea className="h-72">
                  <div className="space-y-2 pr-2">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${statusBg[item.status]} flex items-center gap-3`}
                      >
                        <div className="shrink-0">{statusIcon[item.status]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                              {item.text}
                            </span>
                            {item.selectedMeanings && item.selectedMeanings.length > 0 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                                · {item.selectedMeanings.length} 个释义
                              </span>
                            )}
                          </div>
                          {item.error && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate">
                              {item.error}
                            </p>
                          )}
                        </div>
                        {!isProcessing &&
                          (item.status === 'failed' || item.status === 'skipped') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditWord(index)}
                              className="h-7 px-2 text-xs shrink-0"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              编辑
                            </Button>
                          )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-5 border-t border-gray-100 dark:border-gray-700 gap-3">
            {!hasStarted ? (
              <>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  共 {parseWords(inputText).length} 个单词
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                    取消
                  </Button>
                  <Button
                    onClick={handleBatchAdd}
                    disabled={isProcessing || parseWords(inputText).length === 0}
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {isProcessing ? '正在处理，请稍候...' : `完成: ${successCount}/${totalCount}`}
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {isProcessing ? (
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      取消处理
                    </Button>
                  ) : (
                    <>
                      {hasFailed && (
                        <Button
                          variant="outline"
                          onClick={handleRetryFailed}
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
                        >
                          <RotateCw className="h-4 w-4 mr-1" />
                          重试失败项
                        </Button>
                      )}
                      <Button variant="outline" onClick={handleReset}>
                        继续添加
                      </Button>
                      <Button onClick={onClose} className="bg-emerald-500 hover:bg-emerald-600">
                        完成
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {editingWordIndex !== null && editingWord && (
        <WordModal
          isOpen={true}
          onClose={() => setEditingWordIndex(null)}
          onSave={handleSaveWord}
          initialWord={{
            id: 0,
            text: editingWord.text,
            meanings:
              editingWord.meanings && editingWord.meanings.length > 0
                ? editingWord.meanings
                : editingWord.selectedMeanings ?? [],
            tags: [],
            relatedWords: [],
          }}
          allWords={allWords}
          queryWord={queryWord}
          allTagConfigs={allTagConfigs}
          onTagsUpdate={onTagsUpdate}
          onWordAdded={onWordAdded}
          zIndex={70}
        />
      )}
    </>
  );
};

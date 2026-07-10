'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Minus, Plus, Sparkles, Image as ImageIcon, Zap, ChevronRight, Brain, Maximize2, Highlighter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { WordModal } from '@/components/WordModal';
import { recognizeWordsFromImage } from '@/actions/image-recognition';
import { DictionaryEntry, Meaning } from '@/types/dict';
import { Word, WordTag, TagConfig, RelatedWord } from '@/types/word';
import { saveWord as saveWordAction } from '@/actions/words';

interface RecognizedWord {
  text: string;
  meanings: Meaning[];
  selectedMeanings: Meaning[];
}

interface PhotoWordRecognitionProps {
  isOpen: boolean;
  onClose: () => void;
  queryWord: (word: string) => Promise<DictionaryEntry | null>;
  allTagConfigs: Record<WordTag, TagConfig>;
  onTagsUpdate?: (newTagConfigs: Record<WordTag, TagConfig>) => void;
  allWords?: Word[];
  onWordAdded?: () => void;
}

export const PhotoWordRecognition = ({
  isOpen,
  onClose,
  queryWord,
  allTagConfigs,
  onTagsUpdate,
  allWords = [],
  onWordAdded,
}: PhotoWordRecognitionProps) => {
  const [step, setStep] = useState<'idle' | 'preview' | 'recognizing' | 'results'>('idle');
  const [imageData, setImageData] = useState<string | null>(null);
  const [recognizedWords, setRecognizedWords] = useState<RecognizedWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const [aiThinking, setAiThinking] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);

  const processFile = useCallback(async (file: File) => {
    try {
      const COMPRESSION_THRESHOLD = 1 * 1024 * 1024; // 1MB - 小于此值不压缩
      const MAX_DIM = 2000; // 最大分辨率
      const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB 目标大小

      // 小图片直接使用，不压缩
      if (file.size <= COMPRESSION_THRESHOLD) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.readAsDataURL(file);
        });
        console.log(`📷 小图片不压缩: ${(file.size / 1024).toFixed(0)}KB`);
        setImageData(dataUrl);
        setError(null);
        setStep('preview');
        return;
      }

      // 大图片：读取并压缩
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });

      // 加载图片以获取尺寸信息
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = dataUrl;
      });

      let width = img.naturalWidth;
      let height = img.naturalHeight;
      let needsResize = width > MAX_DIM || height > MAX_DIM;

      // 计算缩放比例
      if (needsResize) {
        const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      // 使用 Canvas 压缩图片
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 初始化失败');
      }

      // 高质量缩放
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // 先尝试高质量 JPEG
      let quality = 0.9;
      let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

      // 如果仍然太大，逐步降低质量
      while (compressedDataUrl.length > MAX_FILE_SIZE * 1.37 && quality > 0.5) { // base64 约为原始大小的 1.37 倍
        quality -= 0.1;
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      // 如果还是太大，进一步缩小尺寸
      if (compressedDataUrl.length > MAX_FILE_SIZE * 1.37) {
        const scaleFactor = 0.7;
        canvas.width = Math.round(width * scaleFactor);
        canvas.height = Math.round(height * scaleFactor);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      }

      console.log(`📷 图片压缩: ${img.naturalWidth}x${img.naturalHeight} → ${canvas.width}x${canvas.height}, 质量=${quality.toFixed(1)}, 大小=${(file.size / 1024).toFixed(0)}KB → ${(compressedDataUrl.length / 1024).toFixed(0)}KB`);

      setImageData(compressedDataUrl);
      setError(null);
      setStep('preview');
    } catch (err) {
      console.error('图片处理失败:', err);
      setError('图片处理失败，请重试');
    }
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    e.target.value = '';
  }, [processFile]);

  useEffect(() => {
    if (isOpen) {
      setStep('idle');
      setImageData(null);
      setRecognizedWords([]);
      setError(null);
      setEditingWordIndex(null);
      setAiThinking('');
      setShowDetails(false);
    }
  }, [isOpen]);

  const handleRecognize = async () => {
    if (!imageData) return;

    setLoading(true);
    setError(null);
    setAiThinking('');
    setStep('recognizing');

    try {
      const result = await recognizeWordsFromImage(imageData);

      setAiThinking(result.thinking);

      console.log('🎯 识别完成:', {
        '识别单词数': result.stats.totalWords,
        '高亮单词数': result.stats.highlightedCount,
        '耗时': `${result.timing.total}s`,
      });

      const wordsWithMeanings = await Promise.all(
        result.words.map(async (word) => {
          const dictEntry = await queryWord(word.text);
          const meanings = dictEntry?.meaning || [];
          return {
            text: word.text,
            meanings,
            selectedMeanings: meanings,
          };
        })
      );

      const validWords = wordsWithMeanings.filter(word => word.meanings.length > 0);

      if (validWords.length === 0 && wordsWithMeanings.length > 0) {
        setError('识别到的单词均未在词典中找到，无法添加');
        setStep('preview');
        return;
      }

      setRecognizedWords(validWords);
      setStep('results');
    } catch (err) {
      console.error('识别失败:', err);
      setError(err instanceof Error ? err.message : '识别失败，请重试');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMeaning = (wordIndex: number, meaningIndex: number) => {
    setRecognizedWords(prev => {
      const updated = [...prev];
      const word = updated[wordIndex];
      const meaning = word.meanings[meaningIndex];
      const isSelected = word.selectedMeanings.some(
        m => m.type === meaning.type && m.content === meaning.content
      );

      if (isSelected) {
        word.selectedMeanings = word.selectedMeanings.filter(
          m => m.type !== meaning.type || m.content !== meaning.content
        );
      } else {
        word.selectedMeanings = [...word.selectedMeanings, meaning];
      }

      return updated;
    });
  };

  const handleSelectAllMeanings = (wordIndex: number) => {
    setRecognizedWords(prev => {
      const updated = [...prev];
      updated[wordIndex].selectedMeanings = [...updated[wordIndex].meanings];
      return updated;
    });
  };

  const handleAddWord = (index: number) => {
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
        setRecognizedWords(prev => prev.filter((_, i) => i !== editingWordIndex));
      }

      await onWordAdded?.();
    } catch (err) {
      console.error('保存失败:', err);
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setEditingWordIndex(null);
    }
  };

  const handleRemoveWord = (index: number) => {
    setRecognizedWords(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditWordText = (index: number, newText: string) => {
    setRecognizedWords(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text: newText };
      return updated;
    });
  };

  const handleBatchAddAll = async () => {
    for (const word of recognizedWords) {
      const meaningsToAdd = word.selectedMeanings.length > 0
        ? word.selectedMeanings
        : word.meanings;

      try {
        await saveWordAction({
          text: word.text,
          meanings: meaningsToAdd,
          tags: [],
          relatedWords: [],
        });
      } catch (err) {
        console.error(`保存单词 ${word.text} 失败:`, err);
      }
    }
    setRecognizedWords([]);
    await onWordAdded?.();
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const editingWord = editingWordIndex !== null ? recognizedWords[editingWordIndex] : null;

  return (
    <>
      <input
        type="file"
        id="photo-word-upload"
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" showCloseButton={false}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 bg-amber-50 dark:bg-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
                <Highlighter className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">拍照识别高亮单词</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">使用荧光笔高亮的单词将被自动识别</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose} className="rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="overflow-auto p-5 max-h-[calc(90vh-140px)]">
            {step === 'idle' && (
                <div className="flex flex-col items-center justify-center py-16 gap-5">
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500">
                      <Highlighter className="h-8 w-8 text-white" />
                    </div>
                    <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-amber-400" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">选择图片开始识别</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">上传用荧光笔高亮生词的图片，自动识别高亮单词</p>
                  </div>
                  <Button asChild className="rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] px-8 py-6 text-white font-semibold transition-all cursor-pointer">
                    <label htmlFor="photo-word-upload" className="cursor-pointer">
                      <div className="flex items-center justify-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        选择图片
                        <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </label>
                  </Button>
                </div>
              )}
              {step === 'preview' && imageData && (
                <div className="space-y-5">
                  <div className="relative group rounded-xl overflow-hidden border-2 border-dashed border-amber-200 dark:border-amber-700/50 bg-amber-50/30 dark:bg-amber-900/10">
                    <img
                      src={imageData}
                      alt="Selected"
                      className="w-full max-h-52 object-contain"
                    />
                    <div className="absolute top-2 right-2">
                      <Button asChild variant="outline" size="sm" className="flex items-center gap-1 rounded-lg bg-white/90 dark:bg-gray-800/90 text-xs font-medium text-gray-600 dark:text-gray-300 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-gray-800 cursor-pointer">
                        <label htmlFor="photo-word-upload" className="cursor-pointer">
                          <ImageIcon className="h-3.5 w-3.5" />
                          重选图片
                        </label>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-300">
                    <Highlighter className="h-4 w-4 shrink-0" />
                    <span>请确保图片中的生词已用荧光笔高亮标记</span>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleRecognize}
                    disabled={loading}
                    className="group relative w-full rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 active:scale-[0.98] px-6 py-3 text-white font-semibold transition-all h-auto"
                  >
                    <div className="flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                          识别中...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          开始识别
                          <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </div>
                  </Button>
                </div>
              )}

              {step === 'recognizing' && (
                <div className="flex flex-col items-center justify-center py-16 gap-5">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-14 w-14 border-4 border-amber-200 dark:border-amber-800"></div>
                    <div className="absolute inset-0 animate-spin rounded-full h-14 w-14 border-4 border-transparent border-t-amber-500" style={{ animationDuration: '1.5s' }}></div>
                    <Highlighter className="absolute inset-0 m-auto h-5 w-5 text-amber-500" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">正在识别高亮单词...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">透视矫正 → 光照增强 → OCR → 高亮检测</p>
                  </div>
                </div>
              )}

              {step === 'results' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      识别结果 ({recognizedWords.length})
                    </h3>
                    {recognizedWords.length > 0 && (
                      <Button
                        variant="default"
                        size="default"
                        onClick={handleBatchAddAll}
                        className="bg-green-500 hover:bg-green-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        全部添加 ({recognizedWords.length}个)
                      </Button>
                    )}
                  </div>

                  {aiThinking && (
                    <div className="rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                          <Brain className="h-4 w-4" />
                          识别详情
                        </div>
                        <Button
                          onClick={() => setShowDetails(!showDetails)}
                          variant="link"
                          size="sm"
                          className="text-xs text-amber-600 dark:text-amber-400"
                        >
                          {showDetails ? '收起' : '展开'}
                          <Maximize2 className={`h-3 w-3 ml-1 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                        </Button>
                      </div>

                      {!showDetails ? (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {aiThinking.split('\n')[0]}
                        </p>
                      ) : (
                        <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-700/50">
                          <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 max-h-48 overflow-y-auto">
                            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                              {aiThinking}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {recognizedWords.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      没有识别到高亮单词
                    </div>
                  ) : (
                    <ScrollArea className="h-72">
                      <div className="space-y-3">
                        {recognizedWords.map((word, index) => {
                          const isSelectedCount = word.selectedMeanings.length;
                          return (
                            <div
                              key={index}
                              className={`p-3 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 ${
                                editingWordIndex === index ? 'ring-2 ring-blue-400' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Input
                                  value={word.text}
                                  onChange={(e) => handleEditWordText(index, e.target.value)}
                                  className="flex-1 font-semibold text-sm h-8"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleAddWord(index)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  添加
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveWord(index)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              </div>

                              {word.meanings.length > 0 && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">选择释义：</span>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={() => handleSelectAllMeanings(index)}
                                      className="text-xs"
                                    >
                                      全选
                                    </Button>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {word.meanings.map((meaning, mIndex) => {
                                      const isSelected = word.selectedMeanings.some(
                                        m => m.type === meaning.type && m.content === meaning.content
                                      );
                                      return (
                                        <button
                                          key={mIndex}
                                          onClick={() => handleToggleMeaning(index, mIndex)}
                                          className={`px-2 py-1 text-xs rounded border transition-colors cursor-pointer ${
                                            isSelected
                                              ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
                                              : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500'
                                          }`}
                                        >
                                          {meaning.type} {meaning.content}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {isSelectedCount > 0 && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      已选择 {isSelectedCount} 个释义
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

      {editingWordIndex !== null && editingWord && (
        <WordModal
          isOpen={true}
          onClose={() => setEditingWordIndex(null)}
          onSave={handleSaveWord}
          initialWord={{
            id: 0,
            text: editingWord.text,
            meanings: editingWord.selectedMeanings.length > 0 ? editingWord.selectedMeanings : editingWord.meanings,
            tags: [],
            relatedWords: [],
          }}
          allWords={allWords}
          queryWord={queryWord}
          allTagConfigs={allTagConfigs}
          onTagsUpdate={onTagsUpdate}
          onWordAdded={onWordAdded}
        />
      )}
    </>
  );
};

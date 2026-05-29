'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle, Minus, Plus, Check, Sparkles, Image as ImageIcon, Zap, ChevronRight, Brain, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WordModal } from '@/components/WordModal';
import { recognizeWordsFromImage } from '@/actions/image-recognition';
import { compressImage } from '@/lib/image-utils';
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

const ANNOTATION_STYLES = [
  { value: '高亮', label: '高亮' },
  { value: '红笔圈出', label: '红笔圈出' },
  { value: '红下划线', label: '红下划线' },
  { value: '黑笔圈出', label: '黑笔圈出' },
  { value: '黑下划线', label: '黑下划线' },
  { value: 'custom', label: '自定义' },
];

export const PhotoWordRecognition = ({
  isOpen,
  onClose,
  queryWord,
  allTagConfigs,
  onTagsUpdate,
  allWords = [],
  onWordAdded,
}: PhotoWordRecognitionProps) => {
  const [step, setStep] = useState<'idle' | 'annotate' | 'recognizing' | 'results'>('idle');
  const [imageData, setImageData] = useState<string | null>(null);
  const [annotationStyle, setAnnotationStyle] = useState<string>('高亮');
  const [customAnnotation, setCustomAnnotation] = useState<string>('');
  const [recognizedWords, setRecognizedWords] = useState<RecognizedWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const [aiThinking, setAiThinking] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getOrCreateFileInput = useCallback((): HTMLInputElement => {
    if (fileInputRef.current && document.body.contains(fileInputRef.current)) {
      fileInputRef.current.value = '';
      return fileInputRef.current;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.top = '0';
    input.style.left = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0.01';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);
    fileInputRef.current = input;
    return input;
  }, []);

  const processFile = useCallback(async (file: File) => {
    try {
      const compressResult = await compressImage(file, {
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 0.8
      });
      setImageData(compressResult.dataUrl);
      setStep('annotate');
    } catch (err) {
      console.error('图片处理失败:', err);
      setError('图片处理失败，请重试');
    }
  }, []);

  const openFilePicker = useCallback(() => {
    const input = getOrCreateFileInput();
    input.onchange = null;
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await processFile(file);
      }
    };
    input.click();
  }, [getOrCreateFileInput, processFile]);

  useEffect(() => {
    if (isOpen) {
      setStep('idle');
      setImageData(null);
      setAnnotationStyle('高亮');
      setCustomAnnotation('');
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
      const style = annotationStyle === 'custom' ? customAnnotation : annotationStyle;
      const result = await recognizeWordsFromImage(imageData, style);
      
      setAiThinking(result.thinking);
      
      console.log('🎯 识别完成:', {
        '识别单词数': result.words.length,
        '识别方式': result.method === 'ocr' ? 'OCR+标记检测' : result.method === 'ocr+ai' ? 'OCR+AI文本分析' : 'AI视觉识别',
        'AI 思考长度': `${result.thinking.length} 字符`,
        'Token 消耗': result.method === 'ai' || result.method === 'ocr+ai' ? `输入 ${result.usage.prompt_tokens} / 输出 ${result.usage.completion_tokens} / 总计 ${result.usage.total_tokens}` : '无（OCR方案）'
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
        setStep('annotate');
        return;
      }
      
      setRecognizedWords(validWords);
      setStep('results');
    } catch (err) {
      console.error('识别失败:', err);
      setError(err instanceof Error ? err.message : '识别失败，请重试');
      setStep('annotate');
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

  const handleReSelectImage = () => {
    openFilePicker();
  };

  if (!isOpen) return null;

  const editingWord = editingWordIndex !== null ? recognizedWords[editingWordIndex] : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 bg-purple-50 dark:bg-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">拍照识别单词</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">AI 智能识别图片中的生词</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose} className="rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-5">
            {step === 'idle' && (
              <div className="flex flex-col items-center justify-center py-16 gap-5">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500">
                    <ImageIcon className="h-8 w-8 text-white" />
                  </div>
                  <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-amber-400" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">选择图片开始识别</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">上传包含标记生词的图片，AI 将自动识别</p>
                </div>
                <button
                  onClick={openFilePicker}
                  type="button"
                  className="group relative rounded-xl bg-purple-500 hover:bg-purple-600 active:scale-[0.98] px-8 py-4 text-white font-semibold transition-all"
                >
                  <div className="flex items-center justify-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    选择图片
                    <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>
            )}
              {step === 'annotate' && imageData && (
                <div className="space-y-5">
                  <div className="relative group rounded-xl overflow-hidden border-2 border-dashed border-purple-200 dark:border-purple-700/50 bg-purple-50/30 dark:bg-purple-900/10">
                    <img
                      src={imageData}
                      alt="Selected"
                      className="w-full max-h-52 object-contain"
                    />
                    <button
                      onClick={handleReSelectImage}
                      className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-white/90 dark:bg-gray-800/90 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-gray-800"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      重选图片
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <Zap className="h-4 w-4 text-amber-500" />
                      你是如何标记不认识的单词的？
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {ANNOTATION_STYLES.map((style) => (
                        <button
                          key={style.value}
                          onClick={() => setAnnotationStyle(style.value)}
                          className={`relative px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            annotationStyle === style.value
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-transparent'
                          }`}
                        >
                          {annotationStyle === style.value && (
                            <Check className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-white text-purple-600 p-0.5" />
                          )}
                          {style.label}
                        </button>
                      ))}
                    </div>

                    {annotationStyle === 'custom' && (
                      <Input
                        value={customAnnotation}
                        onChange={(e) => setCustomAnnotation(e.target.value)}
                        placeholder="请描述你的标记方式..."
                        className="mt-2 rounded-xl border-purple-200 focus:border-purple-500 focus:ring-purple-500/20"
                      />
                    )}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    onClick={handleRecognize}
                    disabled={loading || (annotationStyle === 'custom' && !customAnnotation.trim())}
                    className="group relative w-full rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 active:scale-[0.98] px-6 py-3 text-white font-semibold transition-all"
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
                  </button>
                </div>
              )}

              {step === 'recognizing' && (
                <div className="flex flex-col items-center justify-center py-16 gap-5">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-14 w-14 border-4 border-purple-200 dark:border-purple-800"></div>
                    <div className="absolute inset-0 animate-spin rounded-full h-14 w-14 border-4 border-transparent border-t-purple-500" style={{ animationDuration: '1.5s' }}></div>
                    <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-purple-500" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">正在识别图片中的单词...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">AI 正在分析你的标记并提取生词</p>
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
                    <div className="rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-300">
                          <Brain className="h-4 w-4" />
                          AI 深度思考过程
                        </div>
                        <button
                          onClick={() => setShowDetails(!showDetails)}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                        >
                          {showDetails ? '收起' : '展开'}
                          <Maximize2 className={`h-3 w-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      
                      {!showDetails ? (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {aiThinking}
                        </p>
                      ) : (
                        <div className="mt-3 pt-3 border-t border-purple-200/50 dark:border-purple-700/50">
                          <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 max-h-48 overflow-y-auto">
                            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                              {aiThinking}
                            </pre>
                          </div>
                          
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                              <div className="bg-white/60 dark:bg-gray-800/60 rounded p-2 text-center">
                                <div className="text-gray-500">思考长度</div>
                                <div className="font-semibold text-gray-800 dark:text-gray-200">{aiThinking.length} 字符</div>
                              </div>
                              <div className="bg-white/60 dark:bg-gray-800/60 rounded p-2 text-center">
                                <div className="text-gray-500">处理模式</div>
                                <div className="font-semibold text-blue-600">深度推理</div>
                              </div>
                              <div className="bg-white/60 dark:bg-gray-800/60 rounded p-2 text-center">
                                <div className="text-gray-500">状态</div>
                                <div className="font-semibold text-green-600">✓ 完成</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {recognizedWords.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      没有识别到单词
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
                                    <button
                                      onClick={() => handleSelectAllMeanings(index)}
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      全选
                                    </button>
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

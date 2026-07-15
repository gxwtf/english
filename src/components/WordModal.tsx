'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Check, AlertCircle, CheckSquare, Square, Settings, Camera, Sparkles, ListPlus, Plus, Pencil, Trash2, RotateCcw, Info } from 'lucide-react';
import { DictionaryEntry, Meaning } from '@/types/dict';
import { Word, WordTag, TagConfig, RelatedWord } from '@/types/word';
import { COLOR_PRESETS } from '@/constants/word-tags';
import { TagEditModal } from '@/components/TagEditModal';
import { RelatedWordSelector } from '@/components/RelatedWordSelector';
import { PhotoWordRecognition } from '@/components/PhotoWordRecognition';
import { BatchAddWord } from '@/components/BatchAddWord';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface WordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (word: {
    text: string;
    tags: WordTag[];
    meanings: Meaning[];
    relatedWords?: RelatedWord[];
  }) => Promise<void> | void;
  initialWord?: Word;
  allWords?: Word[];
  queryWord: (word: string) => Promise<DictionaryEntry | null>;
  allTagConfigs: Record<WordTag, TagConfig>;
  onTagsUpdate?: (newTagConfigs: Record<WordTag, TagConfig>) => void;
  onWordAdded?: () => void;
  zIndex?: number;
}

export const WordModal = ({ isOpen, onClose, onSave, initialWord, allWords = [], queryWord, allTagConfigs, onTagsUpdate, onWordAdded, zIndex = 50 }: WordModalProps) => {
  const [word, setWord] = useState('');
  const [dictionaryData, setDictionaryData] = useState<DictionaryEntry | null>(null);
  // 保存原始词典数据，用于"恢复默认释义"
  const [originalDictData, setOriginalDictData] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMeanings, setSelectedMeanings] = useState<Meaning[]>([]);
  const [selectedTags, setSelectedTags] = useState<WordTag[]>([]);
  const [selectedRelatedWords, setSelectedRelatedWords] = useState<RelatedWord[]>([]);
  const [searchedWord, setSearchedWord] = useState('');
  const [showTagEditModal, setShowTagEditModal] = useState(false);
  const [showPhotoRecognition, setShowPhotoRecognition] = useState(false);
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // 用于防止异步查询时单词已切换导致数据错乱
  const currentWordRef = useRef<string>('');
  // 自定义释义输入状态
  const [customMeaningContent, setCustomMeaningContent] = useState('');
  const [customMeaningType, setCustomMeaningType] = useState('');
  // 编辑释义状态：正在编辑的释义在 dictionaryData.meaning 中的索引
  const [editingMeaningIndex, setEditingMeaningIndex] = useState<number | null>(null);

  useEffect(() => {
    setLoading(false);
    if (initialWord) {
      currentWordRef.current = initialWord.text;
      setWord(initialWord.text);
      setSearchedWord(initialWord.text);
      setSelectedMeanings(initialWord.meanings || []);
      setSelectedTags(initialWord.tags);
      setSelectedRelatedWords(initialWord.relatedWords || []);
      setOriginalDictData(null);
      setDictionaryData(null);
    } else {
      setWord('');
      setSearchedWord('');
      setDictionaryData(null);
      setOriginalDictData(null);
      setSelectedMeanings([]);
      setSelectedTags([]);
      setSelectedRelatedWords([]);
      setCustomMeaningContent('');
      setCustomMeaningType('');
      setEditingMeaningIndex(null);
      setError('');
      setLoading(false);
      currentWordRef.current = '';
    }
  }, [initialWord, isOpen]);

  // 当编辑模式下已输入单词时，自动查询词典获取原始数据（用于"恢复默认释义"）
  useEffect(() => {
    if (initialWord && searchedWord && !originalDictData) {
      const fetchOriginalDictData = async () => {
        try {
          const result = await queryWord(searchedWord);
          if (result && currentWordRef.current === searchedWord) {
            setOriginalDictData(result);
          }
        } catch (err) {
          console.error('查询词典失败:', err);
        }
      };
      fetchOriginalDictData();
    }
  }, [initialWord, searchedWord, originalDictData, queryWord]);

  // 当编辑模式下已输入单词且词典数据为空时，自动查询词典
  useEffect(() => {
    if (initialWord && searchedWord && !dictionaryData) {
      const fetchDictionaryData = async () => {
        setLoading(true);
        try {
          const result = await queryWord(searchedWord);
          if (result && currentWordRef.current === searchedWord) {
            setDictionaryData(result);
            setOriginalDictData(result);
          } else if (currentWordRef.current !== searchedWord) {
            // 异步返回时单词已切换，忽略旧结果
          } else {
            if (currentWordRef.current === searchedWord) {
              setDictionaryData({
                word: searchedWord,
                pronunciation: '',
                meaning: []
              });
            }
          }
        } catch (err) {
          console.error('查询词典失败:', err);
        } finally {
          if (currentWordRef.current === searchedWord) {
            setLoading(false);
          }
        }
      };
      fetchDictionaryData();
    }
  }, [initialWord, searchedWord, dictionaryData, queryWord]);

  const handleSearch = async (clearSelectedMeanings = true) => {
    if (!word.trim()) {
      setError('请输入要查询的单词');
      return;
    }

    setLoading(true);
    setError('');
    const newSearchedWord = word.trim();
    setSearchedWord(newSearchedWord);

    try {
      const result = await queryWord(newSearchedWord);

      // 在编辑模式下（不清空释义时），保留已选择的释义
      if (!clearSelectedMeanings && selectedMeanings.length > 0) {
        // 创建新的 dictionaryData，包含词典释义和已选择的释义
        const newMeanings = result ? result.meaning : [];
        const selectedMeaningKeys = new Set(
          selectedMeanings.map(m => `${m.content}-${m.type}`)
        );

        // 合并释义：先添加词典释义，再添加不在词典中的已选择释义
        const mergedMeanings = [
          ...newMeanings,
          ...selectedMeanings.filter(m => !newMeanings.some(
            nm => nm.content === m.content && nm.type === m.type
          ))
        ];

        const newDictData = {
          word: newSearchedWord,
          pronunciation: result?.pronunciation || '',
          meaning: mergedMeanings
        };
        setDictionaryData(newDictData);
        setOriginalDictData(result);
      } else {
        // 添加模式下，直接使用词典数据
        if (result) {
          setDictionaryData(result);
          setOriginalDictData(result);
        } else {
          setDictionaryData({
            word: newSearchedWord,
            pronunciation: '',
            meaning: []
          });
          setOriginalDictData(null);
        }
        // 清空已选择的释义
        setSelectedMeanings([]);
      }
    } catch (err) {
      setError('查询失败，请重试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 编辑模式下查询单词（不清空已选择的释义）
  const handleEditSearch = async () => {
    await handleSearch(false);
  };

  // 添加或保存编辑释义
  const saveCustomMeaning = () => {
    if (!customMeaningContent.trim()) {
      setError('请输入释义内容');
      return;
    }

    // 确保有单词（使用 searchedWord 或 word 输入框的值）
    const currentWord = searchedWord.trim() || word.trim();
    if (!currentWord) {
      setError('请先输入单词');
      return;
    }

    const newMeaning: Meaning = {
      content: customMeaningContent.trim(),
      type: customMeaningType.trim() || '自定义',
    };

    // 如果还没有 searchedWord，设置它
    if (!searchedWord.trim()) {
      setSearchedWord(currentWord);
    }

    if (editingMeaningIndex !== null && dictionaryData) {
      // 编辑模式：替换原有释义
      const oldMeaning = dictionaryData.meaning[editingMeaningIndex];
      setDictionaryData(prev => {
        if (!prev) return null;
        const newMeanings = [...prev.meaning];
        newMeanings[editingMeaningIndex] = newMeaning;
        return { ...prev, meaning: newMeanings };
      });
      // 同步更新 selectedMeanings 中的对应项
      setSelectedMeanings(prev => {
        const idx = prev.findIndex(m => m.content === oldMeaning.content && m.type === oldMeaning.type);
        if (idx === -1) return [...prev, newMeaning]; // 原来没选中，则直接添加
        const newArr = [...prev];
        newArr[idx] = newMeaning;
        return newArr;
      });
      setEditingMeaningIndex(null);
    } else {
      // 添加模式
      setSelectedMeanings(prev => {
        const exists = prev.some(m => m.content === newMeaning.content && m.type === newMeaning.type);
        if (exists) return prev;
        return [...prev, newMeaning];
      });

      if (dictionaryData) {
        setDictionaryData(prev => {
          if (!prev) return null;
          const exists = prev.meaning.some(m => m.content === newMeaning.content && m.type === newMeaning.type);
          if (exists) return prev;
          return { ...prev, meaning: [...prev.meaning, newMeaning] };
        });
      } else {
        setDictionaryData({
          word: currentWord,
          pronunciation: '',
          meaning: [newMeaning]
        });
      }
    }

    setCustomMeaningContent('');
    setCustomMeaningType('');
    setError('');
  };

  // 开始编辑释义
  const startEditMeaning = (index: number) => {
    if (!dictionaryData) return;
    const meaning = dictionaryData.meaning[index];
    setCustomMeaningContent(meaning.content);
    setCustomMeaningType(meaning.type === '自定义' ? '' : meaning.type);
    setEditingMeaningIndex(index);
    setError('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setCustomMeaningContent('');
    setCustomMeaningType('');
    setEditingMeaningIndex(null);
  };

  // 删除释义
  const deleteMeaning = (index: number) => {
    if (!dictionaryData) return;
    const meaning = dictionaryData.meaning[index];

    setDictionaryData(prev => {
      if (!prev) return null;
      return { ...prev, meaning: prev.meaning.filter((_, i) => i !== index) };
    });

    setSelectedMeanings(prev =>
      prev.filter(m => !(m.content === meaning.content && m.type === meaning.type))
    );

    // 如果正在编辑被删除的释义，取消编辑
    if (editingMeaningIndex === index) {
      cancelEdit();
    } else if (editingMeaningIndex !== null && editingMeaningIndex > index) {
      // 如果删除的释义在编辑的释义之前，调整索引
      setEditingMeaningIndex(editingMeaningIndex - 1);
    }
  };

  // 恢复默认释义（恢复为词典原始数据）
  const restoreDefaultMeanings = () => {
    if (!originalDictData) return;
    setDictionaryData({ ...originalDictData });
    setSelectedMeanings(originalDictData.meaning.map((m: any) => m));
    cancelEdit();
  };

  const toggleMeaning = (meaning: Meaning) => {
    setSelectedMeanings(prev => {
      const exists = prev.some(m => m.content === meaning.content && m.type === meaning.type);
      if (exists) {
        return prev.filter(m => !(m.content === meaning.content && m.type === meaning.type));
      } else {
        // 添加新释义时，保留词典中的完整信息（包括 sentence）
        return [...prev, meaning];
      }
    });
  };

  const toggleTag = (tag: WordTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!searchedWord.trim()) {
      setError('请输入单词');
      return;
    }
    if (selectedMeanings.length === 0) {
      setError('请至少选择一个释义');
      return;
    }

    await onSave({
      text: searchedWord.trim(),
      meanings: selectedMeanings,
      tags: selectedTags,
      relatedWords: selectedRelatedWords
    });

    onClose();
  };

  const isSaveDisabled = !searchedWord.trim() || selectedMeanings.length === 0;

  if (!isOpen) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">
            {initialWord ? '编辑单词' : '添加单词'}
          </DialogTitle>
        </DialogHeader>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto">
          {/* 搜索单词 */}
          <div className="mb-4 sm:mb-6">
            <label htmlFor="word-search-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              搜索单词
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                id="word-search-input"
                ref={searchInputRef}
                placeholder="输入要查询的英文单词..."
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (initialWord ? handleEditSearch() : handleSearch())}
                className="flex-1"
              />
              <Button onClick={() => (initialWord ? handleEditSearch() : handleSearch())} disabled={loading} className="whitespace-nowrap">
                <Search className="h-4 w-4 mr-2" />
                {loading ? '查询中...' : '查询'}
              </Button>
            </div>
            {!initialWord && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPhotoRecognition(true);
                  }}
                  className="flex-1 rounded-xl bg-purple-500 hover:bg-purple-600 active:scale-[0.98] px-4 py-3 text-white font-medium transition-all h-auto"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Camera className="h-5 w-5" />
                        <Sparkles className="absolute -top-2 -right-2 h-3 w-3 text-amber-400" />
                      </div>
                      <span>拍照识别单词</span>
                    </div>
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold">
                      NEW
                    </span>
                  </div>
                </Button>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowBatchAdd(true);
                  }}
                  className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] px-4 py-3 text-white font-medium transition-all h-auto"
                >
                  <ListPlus className="h-5 w-5" />
                  <span>批量添加单词</span>
                </Button>
              </div>
            )}
            {error && (
              <div className="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 mr-1" />
                {error}
              </div>
            )}
          </div>

          {/* 单词信息 */}
          {(dictionaryData || word.trim()) && (
            <div className="space-y-6">
              {/* 单词标题 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {dictionaryData?.word || word.trim()}
                </h3>
                {dictionaryData?.pronunciation && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    音标: {dictionaryData.pronunciation}
                  </p>
                )}
              </div>

              {/* 释义选择区域 */}
              {dictionaryData && dictionaryData.meaning.length > 0 && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      选择不熟悉的释义（至少选一个）:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {originalDictData && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={restoreDefaultMeanings}
                          className="h-8 px-3 text-xs whitespace-nowrap text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">恢复默认</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedMeanings(dictionaryData.meaning.map((m: any) => m));
                        }}
                        className="h-8 px-3 text-xs whitespace-nowrap"
                      >
                        <CheckSquare className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">全选</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const meaningsWithoutDef = dictionaryData.meaning.filter((m: any) => m.type !== 'def.');
                          setSelectedMeanings(meaningsWithoutDef);
                        }}
                        className="h-8 px-3 text-xs whitespace-nowrap"
                      >
                        <CheckSquare className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">全选（def.除外）</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedMeanings([])}
                        className="h-8 px-3 text-xs whitespace-nowrap"
                      >
                        <Square className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">全不选</span>
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {dictionaryData.meaning.map((meaning: any, index: number) => {
                        const isSelected = selectedMeanings.some(
                          m => m.content === meaning.content && m.type === meaning.type
                        );
                        const meaningKey = `${meaning.content}-${meaning.type}-${index}`;
                        const isEditing = editingMeaningIndex === index;
                        return (
                          <div
                            key={meaningKey}
                            className={`p-3 rounded-lg border transition-colors ${
                              isEditing
                                ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700'
                                : isSelected
                                  ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                  : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600'
                            }`}
                            onClick={() => !isEditing && toggleMeaning(meaning)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`text-sm font-medium ${
                                    isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                                  }`}>
                                    {meaning.content}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {meaning.type}
                                  </Badge>
                                  {isEditing && (
                                    <Badge className="text-xs bg-amber-500 text-white">编辑中</Badge>
                                  )}
                                </div>
                                {meaning.sentence && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    例句: {meaning.sentence}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                {!isEditing && (
                                  <>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); startEditMeaning(index); }}
                                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                      title="编辑"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    {meaning.type === '自定义' && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteMeaning(index); }}
                                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                        title="删除"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                                {isSelected && !isEditing && (
                                  <Check className="h-5 w-5 text-blue-600 dark:text-blue-400 ml-1" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  {selectedMeanings.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        已选择 {selectedMeanings.length} 个释义
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 编辑释义区域（只要有单词就显示） */}
              <div className={`${dictionaryData && dictionaryData.meaning.length > 0 ? 'mt-4 pt-4 border-t border-gray-200 dark:border-gray-700' : ''}`}>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {editingMeaningIndex !== null ? '编辑释义:' : '添加释义:'}
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="输入释义内容..."
                      value={customMeaningContent}
                      onChange={(e) => setCustomMeaningContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customMeaningContent.trim() && word.trim()) {
                          saveCustomMeaning();
                        }
                      }}
                      className="w-full"
                      autoFocus={editingMeaningIndex !== null}
                    />
                  </div>
                  <div className="w-full sm:w-36">
                    <Select value={customMeaningType || '_empty_'} onValueChange={(v) => setCustomMeaningType(v === '_empty_' ? '' : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择词性" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_empty_">自定义</SelectItem>
                        <SelectItem value="n.">n. 名词</SelectItem>
                        <SelectItem value="v.">v. 动词</SelectItem>
                        <SelectItem value="vt.">vt. 及物动词</SelectItem>
                        <SelectItem value="vi.">vi. 不及物动词</SelectItem>
                        <SelectItem value="a.">a. 形容词</SelectItem>
                        <SelectItem value="adj.">adj. 形容词</SelectItem>
                        <SelectItem value="adv.">adv. 副词</SelectItem>
                        <SelectItem value="prep.">prep. 介词</SelectItem>
                        <SelectItem value="conj.">conj. 连词</SelectItem>
                        <SelectItem value="pron.">pron. 代词</SelectItem>
                        <SelectItem value="interj.">interj. 感叹词</SelectItem>
                        <SelectItem value="def.">def. 释义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    {editingMeaningIndex !== null ? (
                      <>
                        <Button
                          onClick={saveCustomMeaning}
                          disabled={!customMeaningContent.trim() || !word.trim()}
                          className="whitespace-nowrap"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          保存
                        </Button>
                        <Button
                          variant="outline"
                          onClick={cancelEdit}
                          className="whitespace-nowrap"
                        >
                          取消
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={saveCustomMeaning}
                        disabled={!customMeaningContent.trim() || !word.trim()}
                        className="whitespace-nowrap"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        添加
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-1.5 mt-2">
                  <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {editingMeaningIndex !== null
                      ? '修改完成后点击"保存"。词性不选则默认为"自定义"。'
                      : '如果词典释义不全，可自行添加释义。词性不选则默认为"自定义"。添加后自动选中。列表中的释义可点击 ✏️ 编辑或 🗑️ 删除。'
                    }
                  </p>
                </div>
              </div>

              {/* 标签选择 */}
              <div>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    选择标签:
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTagEditModal(true)}
                    className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">标签管理</span>
                    <span className="sm:hidden">标签</span>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(allTagConfigs) as WordTag[]).map(tag => {
                    const tagConfig = allTagConfigs[tag];
                    if (!tagConfig) return null;
                    const isSelected = selectedTags.includes(tag);
                    const colorPreset = COLOR_PRESETS.find(c => c.id === tagConfig.colorId);

                    return (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={`
                          ${
                            isSelected
                              // 选中时保持原背景，添加蓝色边框
                              ? colorPreset
                                ? `${colorPreset.className} dark:bg-gray-800 dark:text-gray-300 ring-2 ring-blue-500 ring-offset-1 shadow-md`
                                : 'bg-blue-100 text-blue-800 border-blue-500 ring-2 ring-blue-500 ring-offset-1'
                              // 未选中时使用浅色背景
                              : colorPreset
                                ? `${colorPreset.className} dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-opacity-80`
                                : 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-opacity-80'
                          }
                          cursor-pointer transition-all hover:scale-105 hover:opacity-90
                        `}
                        onClick={() => toggleTag(tag)}
                      >
                        {tagConfig.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* 关联单词选择 */}
              <RelatedWordSelector
                currentWordText={searchedWord}
                selectedRelatedWords={selectedRelatedWords}
                onSelectChange={setSelectedRelatedWords}
                queryWord={async (word: string) => {
                  const result = await queryWord(word);
                  return result ? { word: result.word } : null;
                }}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6">
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
            {selectedMeanings.length > 0 && (
              <span>已选择 {selectedMeanings.length} 个释义</span>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaveDisabled}
              className="flex-1 sm:flex-none min-w-[80px]"
            >
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      {showTagEditModal && (
        <TagEditModal
          isOpen={showTagEditModal}
          onClose={() => setShowTagEditModal(false)}
          onTagsUpdate={(newTagConfigs) => {
            setShowTagEditModal(false);
            onTagsUpdate?.(newTagConfigs);
          }}
          currentTags={allTagConfigs}
        />
      )}

      {showPhotoRecognition && (
        <PhotoWordRecognition
          isOpen={showPhotoRecognition}
          onClose={() => setShowPhotoRecognition(false)}
          queryWord={queryWord}
          allTagConfigs={allTagConfigs}
          onTagsUpdate={onTagsUpdate}
          allWords={allWords}
          onWordAdded={onWordAdded}
        />
      )}

      {showBatchAdd && (
        <BatchAddWord
          isOpen={showBatchAdd}
          onClose={() => setShowBatchAdd(false)}
          queryWord={queryWord}
          allTagConfigs={allTagConfigs}
          onTagsUpdate={onTagsUpdate}
          allWords={allWords}
          onWordAdded={onWordAdded}
        />
      )}
    </>
  );
};
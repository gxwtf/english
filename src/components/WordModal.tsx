'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Check, AlertCircle, CheckSquare, Square, Settings, Camera, Sparkles, ListPlus } from 'lucide-react';
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

  useEffect(() => {
    if (initialWord) {
      setWord(initialWord.text);
      setSearchedWord(initialWord.text);
      setSelectedMeanings(initialWord.meanings || []);
      setSelectedTags(initialWord.tags);
      setSelectedRelatedWords(initialWord.relatedWords || []);
      
      if (initialWord.meanings && initialWord.meanings.length > 0) {
        setDictionaryData({
          word: initialWord.text,
          pronunciation: '',
          meaning: initialWord.meanings
        });
      } else {
        setDictionaryData(null);
      }
    } else {
      setWord('');
      setDictionaryData(null);
      setSelectedMeanings([]);
      setSelectedTags([]);
      setSelectedRelatedWords([]);
      setError('');
      // 添加单词模式，自动聚焦搜索框
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [initialWord, isOpen]);

  // 当编辑模式下已输入单词且词典数据为空时，自动查询词典
  useEffect(() => {
    if (initialWord && searchedWord && !dictionaryData) {
      const fetchDictionaryData = async () => {
        setLoading(true);
        try {
          const result = await queryWord(searchedWord);
          if (result) {
            setDictionaryData(result);
          } else {
            // 如果没有查询到结果，使用空数据
            setDictionaryData({
              word: searchedWord,
              pronunciation: '',
              meaning: []
            });
          }
        } catch (err) {
          console.error('查询词典失败:', err);
        } finally {
          setLoading(false);
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
    setSearchedWord(word.trim());

    try {
      const result = await queryWord(word.trim());
      if (result) {
        // 校验词典返回的单词是否与请求一致
        if (result.word.toLowerCase() !== word.trim().toLowerCase()) {
          console.error(
            `[WordModal] 词典结果不匹配: 请求="${word.trim()}", 返回="${result.word}"`
          );
          setError(`词典返回了 "${result.word}" 的释义，与请求的 "${word.trim()}" 不匹配，请重试`);
          return;
        }
        setDictionaryData(result);
      } else {
        setDictionaryData({
          word: word.trim(),
          pronunciation: '',
          meaning: []
        });
      }
      // 只有用户主动查询时才清空已选择的释义
      if (clearSelectedMeanings) {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4" style={{ zIndex }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 gap-2">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate flex-1">
            {initialWord ? '编辑单词' : '添加单词'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
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
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPhotoRecognition(true);
                  }}
                  className="group relative flex-1 cursor-pointer rounded-xl bg-purple-500 hover:bg-purple-600 active:scale-[0.98] pointer-events-auto px-4 py-3 text-white font-medium transition-all"
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
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowBatchAdd(true);
                  }}
                  className="group relative flex-1 cursor-pointer rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] pointer-events-auto px-4 py-3 text-white font-medium transition-all"
                >
                  <div className="flex items-center justify-center gap-2">
                    <ListPlus className="h-5 w-5" />
                    <span>批量添加单词</span>
                  </div>
                </button>
              </div>
            )}
            {error && (
              <div className="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 mr-1" />
                {error}
              </div>
            )}
          </div>

          {/* 查询结果 */}
          {dictionaryData && (
            <div className="space-y-6">
              {/* 单词信息 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {dictionaryData.word}
                </h3>
                {dictionaryData.pronunciation && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    音标: {dictionaryData.pronunciation}
                  </p>
                )}
              </div>

              {/* 释义选择 */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    选择不熟悉的释义（至少选一个）:
                  </h4>
                  <div className="flex flex-wrap gap-2">
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
                      return (
                        <div
                          key={meaningKey}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700'
                              : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                          onClick={() => toggleMeaning(meaning)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-sm font-medium ${
                                  isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                                }`}>
                                  {meaning.content}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {meaning.type}
                                </Badge>
                              </div>
                              {meaning.sentence && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  例句: {meaning.sentence}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="h-5 w-5 text-blue-600 dark:text-blue-400 ml-2" />
                            )}
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

        {/* 底部 */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 gap-3">
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
        </div>
      </div>
    </div>
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
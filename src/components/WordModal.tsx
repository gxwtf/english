'use client';

import { useState, useEffect } from 'react';
import { X, Search, Check, AlertCircle, CheckSquare, Settings } from 'lucide-react';
import { DictionaryEntry, Meaning } from '@/types/dict';
import { Word, WordTag, TagConfig } from '@/types/word';
import { COLOR_PRESETS, ICON_PRESETS } from '@/constants/word-tags';
import { TagEditModal } from '@/components/TagEditModal';
import { IconBadge } from '@/components/IconBadge';
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
    meanings: {
      content: string;
      type: string;
      sentence: string;
    }[];
  }) => void;
  initialWord?: Word;
  queryWord: (word: string) => Promise<DictionaryEntry | null>;
  allTagConfigs: Record<WordTag, TagConfig>;
  onTagsUpdate?: (newTagConfigs: Record<WordTag, TagConfig>) => void;
}

export const WordModal = ({ isOpen, onClose, onSave, initialWord, queryWord, allTagConfigs, onTagsUpdate }: WordModalProps) => {
  const [word, setWord] = useState('');
  const [dictionaryData, setDictionaryData] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMeanings, setSelectedMeanings] = useState<Meaning[]>([]);
  const [selectedTags, setSelectedTags] = useState<WordTag[]>([]);
  const [searchedWord, setSearchedWord] = useState('');
  const [showTagEditModal, setShowTagEditModal] = useState(false);

  useEffect(() => {
    if (initialWord) {
      setWord(initialWord.text);
      setSearchedWord(initialWord.text);
      // 加载已保存的释义
      setSelectedMeanings(initialWord.meanings?.map(m => ({
        content: m.content,
        type: m.type,
        sentence: m.sentence || ''
      })) || []);
      setSelectedTags(initialWord.tags);
      // 为编辑模式加载词典数据以便显示
      if (initialWord.meanings && initialWord.meanings.length > 0) {
        setDictionaryData({
          word: initialWord.text,
          pronunciation: '',
          meaning: initialWord.meanings
        });
      }
    } else {
      setWord('');
      setDictionaryData(null);
      setSelectedMeanings([]);
      setSelectedTags([]);
      setError('');
    }
  }, [initialWord, isOpen]);

  const handleSearch = async () => {
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
        setDictionaryData(result);
      } else {
        setDictionaryData({
          word: word.trim(),
          pronunciation: '',
          meaning: []
        });
      }
      setSelectedMeanings([]);
    } catch (err) {
      setError('查询失败，请重试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMeaning = (meaning: Meaning) => {
    setSelectedMeanings(prev => {
      const exists = prev.some(m => m.content === meaning.content && m.type === meaning.type);
      if (exists) {
        return prev.filter(m => !(m.content === meaning.content && m.type === meaning.type));
      } else {
        return [...prev, meaning];
      }
    });
  };

  const toggleTag = (tag: WordTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    if (!searchedWord.trim()) {
      setError('请输入单词');
      return;
    }
    if (selectedMeanings.length === 0) {
      setError('请至少选择一个释义');
      return;
    }

    // 转换数据格式以匹配组件需求
    const meaningsData = selectedMeanings.map(meaning => ({
      content: meaning.content,
      type: meaning.type,
      sentence: ''
    }));

    onSave({
      text: searchedWord.trim(),
      meanings: meaningsData,
      tags: selectedTags
    });

    onClose();
  };

  const isSaveDisabled = !searchedWord.trim() || selectedMeanings.length === 0;

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {initialWord ? '编辑单词' : '添加单词'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-6">
          {/* 搜索单词 */}
          <div className="mb-6">
            <label htmlFor="word-search-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              搜索单词
            </label>
            <div className="flex gap-2">
              <Input
                id="word-search-input"
                placeholder="输入要查询的英文单词..."
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? '查询中...' : '查询'}
              </Button>
            </div>
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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    选择不熟悉的释义（至少选一个）:
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMeanings(dictionaryData.meaning.map((m: any) => m));
                      }}
                      className="h-8 px-3 text-xs"
                    >
                      <CheckSquare className="h-3 w-3 mr-1" />
                      全选
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const meaningsWithoutDef = dictionaryData.meaning.filter((m: any) => m.type !== 'def.');
                        setSelectedMeanings(meaningsWithoutDef);
                      }}
                      className="h-8 px-3 text-xs"
                    >
                      <CheckSquare className="h-3 w-3 mr-1" />
                      全选（def.除外）
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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    选择标签:
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTagEditModal(true)}
                    className="h-8 px-3 text-xs"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    标签管理
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(allTagConfigs) as WordTag[]).map(tag => {
                    const tagConfig = allTagConfigs[tag];
                    if (!tagConfig) return null;
                    const isSelected = selectedTags.includes(tag);
                    const colorPreset = COLOR_PRESETS.find(c => c.id === tagConfig.colorId);

                    // 获取选中状态的样式：将浅色背景 -50 替换为 -600，同时为深色模式准备 -900 背景
                    const getSelectedBgClass = (bgClass: string): string => {
                      return bgClass.replace(/-50/g, '-600');
                    };
                    // 为深色模式准备更深的背景色
                    const getDarkBgClass = (bgClass: string): string => {
                      return bgClass.replace(/-50/g, '-900');
                    };

                    return (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={`
                          ${
                            isSelected
                              // 选中时使用深色背景 + 白色文字
                              ? colorPreset
                                ? `${getSelectedBgClass(colorPreset.bgClass)} text-white border-transparent ${getDarkBgClass(colorPreset.bgClass)} dark:bg-opacity-80 dark:text-white`
                                : 'bg-primary text-primary-foreground border-transparent'
                              // 未选中时使用浅色背景
                              : colorPreset
                                ? `${colorPreset.className} dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-opacity-80`
                                : 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-opacity-80'
                          }
                          cursor-pointer transition-all hover:scale-105 hover:opacity-90
                          ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
                        `}
                        onClick={() => toggleTag(tag)}
                      >
                        <IconBadge iconId={tagConfig.iconId} size="md" />
                        <span className="ml-1">{tagConfig.name}</span>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {selectedMeanings.length > 0 && (
              <span>已选择 {selectedMeanings.length} 个释义</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaveDisabled}
              className="min-w-[80px]"
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
    </>
  );
};
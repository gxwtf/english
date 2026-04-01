'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { WordToolbar } from '@/components/WordToolbar';
import { WordCard } from '@/components/WordCard';
import { WordModal } from '@/components/WordModal';
import { AIQuestionTypeSelector, type AIQuestionType } from '@/components/AIQuestionTypeSelector';
import { Word, WordTag, TagConfig } from '@/types/word';
import { DictionaryEntry } from '@/types/dict';
import { storage } from '@/lib/storage';

interface AuthenticatedPageProps {
  queryWord: (word: string) => Promise<DictionaryEntry | null>;
}

export const AuthenticatedPage = ({ queryWord }: AuthenticatedPageProps) => {
  const { isLoggedIn, isClient } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [selectedWordIds, setSelectedWordIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'default' | 'alphabet'>('default');
  const [filterTags, setFilterTags] = useState<WordTag[]>([]);
  const [filterLogic, setFilterLogic] = useState<'and' | 'or'>('or');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [allTagConfigs, setAllTagConfigs] = useState<Record<WordTag, TagConfig>>({});
  const [showAISelector, setShowAISelector] = useState(false);

  // 从本地存储加载单词和标签配置
  useEffect(() => {
    const loadedWords = storage.getWords();
    setWords(loadedWords);

    const loadedTagConfigs = storage.getTagConfigs();
    setAllTagConfigs(loadedTagConfigs);
  }, []);

  // 保存单词到本地存储
  const handleSaveWord = (wordData: {
    text: string;
    meanings: {
      content: string;
      type: string;
      sentence: string;
    }[];
    tags: WordTag[];
  }) => {
    let newWord: Word;

    if (editingWord) {
      // 更新现有单词
      newWord = {
        ...editingWord,
        tags: wordData.tags,
        meanings: wordData.meanings,
      };
      storage.updateWord(editingWord.id, newWord);
      setWords(prev => prev.map(w => w.id === editingWord.id ? newWord : w));
    } else {
      // 添加新单词 - 检查是否已存在相同单词
      const existingWord = words.find(w => w.text === wordData.text);
      if (existingWord) {
        // 已存在相同单词，覆盖它
        newWord = {
          ...existingWord,
          tags: wordData.tags,
          meanings: wordData.meanings,
        };
        storage.updateWord(existingWord.id, newWord);
        setWords(prev => prev.map(w => w.id === existingWord.id ? newWord : w));
      } else {
        // 添加新单词 - 使用 timestamps 确保唯一性
        const newId = Date.now();
        newWord = {
          id: newId,
          text: wordData.text,
          tags: wordData.tags,
          meanings: wordData.meanings,
        };
        storage.addWord(newWord);
        setWords(prev => [...prev, newWord]);
      }
    }

    setEditingWord(undefined);
  };

  const handleDeleteWord = (id: number) => {
    storage.deleteWord(id);
    setWords(prev => prev.filter(w => w.id !== id));
    setSelectedWordIds(prev => prev.filter(wordId => wordId !== id));
  };

  const handleDeleteSelected = () => {
    if (selectedWordIds.length === 0) return;

    storage.deleteWordsByIds(selectedWordIds);
    setWords(prev => prev.filter(w => !selectedWordIds.includes(w.id)));
    setSelectedWordIds([]);
    setShowDeleteConfirm(false);
  };

  // 处理标签配置更新
  const handleTagsUpdate = (newTagConfigs: Record<WordTag, TagConfig>) => {
    storage.updateTagConfigs(newTagConfigs);
    setAllTagConfigs(newTagConfigs);
  };

  // 筛选和排序单词
  const filteredAndSortedWords = useMemo(() => {
    let filtered = words;

    // 搜索筛选
    if (searchTerm) {
      filtered = filtered.filter(word =>
        word.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 标签筛选
    if (filterTags.length > 0) {
      if (filterLogic === 'and') {
        // 全部满足
        filtered = filtered.filter(word =>
          filterTags.every(tag => word.tags.includes(tag))
        );
      } else {
        // 任一满足
        filtered = filtered.filter(word =>
          word.tags.some(tag => filterTags.includes(tag))
        );
      }
    }

    // 排序
    if (sortBy === 'alphabet') {
      filtered = [...filtered].sort((a, b) => a.text.localeCompare(b.text));
    }

    return filtered;
  }, [words, searchTerm, filterTags, filterLogic, sortBy]);

  const handleToggleSelect = (id: number) => {
    setSelectedWordIds(prev =>
      prev.includes(id) ? prev.filter(wordId => wordId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedWordIds.length === filteredAndSortedWords.length) {
      setSelectedWordIds([]);
    } else {
      setSelectedWordIds(filteredAndSortedWords.map(w => w.id));
    }
  };

  const handleAIGenerate = () => {
    if (selectedWordIds.length === 0) return;
    setShowAISelector(true);
  };

  const handleSelectQuestionType = (type: AIQuestionType) => {
    console.log(`选择题目类型：${type}`);
    // TODO: 根据题目类型生成题目
    setShowAISelector(false);
  };

  // 处理标签点击 - 用于快速筛选
  const handleTagClick = (clickedTag: WordTag, isAdditive: boolean) => {
    // 如果当前没有筛选该标签，或者点击的是不同的标签，则添加/切换
    if (!filterTags.includes(clickedTag)) {
      setFilterTags([clickedTag]);
      setFilterLogic('or');
    } else if (isAdditive) {
      // 如果已经包含该标签且是附加模式，移除它
      setFilterTags(prev => prev.filter(t => t !== clickedTag));
    } else {
      // 否则切换逻辑（OR/AND）
      setFilterLogic(prev => prev === 'and' ? 'or' : 'and');
    }
  };

  // 如果未登录或尚未完成客户端初始化，显示未登录页面
  if (!isLoggedIn || !isClient) {
    return <UnauthenticatedPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 导航栏 */}
      <Navbar currentPage="wordbook" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              我的单词本
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              共 {words.length} 个单词，{filteredAndSortedWords.length} 个符合条件
            </p>
          </div>

          <button
            onClick={() => {
              setEditingWord(undefined);
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="h-5 w-5" />
            添加单词
          </button>
        </div>

        {/* 工具栏 */}
        <WordToolbar
          selectedWordIds={selectedWordIds}
          allWordIds={words.map(w => w.id)}
          sortBy={sortBy}
          filterTags={filterTags}
          filterLogic={filterLogic}
          searchTerm={searchTerm}
          allTagConfigs={allTagConfigs}
          onToggleSelectAll={handleToggleSelectAll}
          onSort={setSortBy}
          onFilterChange={(tags, logic) => {
            setFilterTags(tags);
            setFilterLogic(logic);
          }}
          onTagConfigsUpdate={handleTagsUpdate}
          onAIGenerate={handleAIGenerate}
          onDeleteSelected={() => setShowDeleteConfirm(true)}
          onSearchChange={setSearchTerm}
        />

        {/* 确认删除弹窗 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                确认删除
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                确定要删除选中的 {selectedWordIds.length} 个单词吗？此操作不可恢复。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 单词列表 */}
        {filteredAndSortedWords.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-600 mb-4">
              {words.length === 0 ? (
                <p>还没有添加任何单词</p>
              ) : (
                <p>没有符合条件的单词</p>
              )}
            </div>
            {words.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                点击添加第一个单词
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedWords.map(word => (
              <WordCard
                key={word.id}
                word={word}
                isSelected={selectedWordIds.includes(word.id)}
                onToggleSelect={handleToggleSelect}
                onEdit={(word) => {
                  setEditingWord(word);
                  setShowModal(true);
                }}
                onDelete={handleDeleteWord}
                allTagConfigs={allTagConfigs}
                onTagClick={handleTagClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* 添加/编辑单词弹窗 */}
      <WordModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingWord(undefined);
        }}
        onSave={handleSaveWord}
        initialWord={editingWord}
        queryWord={queryWord}
        allTagConfigs={allTagConfigs}
        onTagsUpdate={handleTagsUpdate}
      />

      {/* AI 出题类型选择器 */}
      <AIQuestionTypeSelector
        isOpen={showAISelector}
        onClose={() => setShowAISelector(false)}
        onSelectType={handleSelectQuestionType}
      />
    </div>
  );
};
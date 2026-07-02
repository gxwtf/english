'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { WordToolbar } from '@/components/WordToolbar';
import { WordCard } from '@/components/WordCard';
import { WordModal } from '@/components/WordModal';
import { AIQuestionTypeSelector, type QuestionGenerationOptions } from '@/components/AIQuestionTypeSelector';
import {
  QuestionType,
  Word,
  WordTag,
  TagConfig,
  RelatedWord,
} from '@/types/word';
import { DictionaryEntry, Meaning } from '@/types/dict';
import { storage } from '@/lib/storage';
import { saveWord as saveWordAction, deleteWords as deleteWordsAction } from '@/actions/words';
import {
  enqueuePendingFillBlank,
  enqueuePendingTranslate,
  enqueuePendingMeaningSelect,
  enqueuePendingMeaningSelectEn,
  enqueuePendingDefinitionFillBlank,
  enqueuePendingWordSelectTranslate,
} from '@/actions/ai-question';
import { selectWordsForQuestion, type RelatedWordEntry } from '@/lib/word-selection';
import { useRouter } from 'next/navigation';

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
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const relatedWordsCount = useMemo(() => {
    const selectedWords = words.filter(w => selectedWordIds.includes(w.id));
    const selectedTexts = new Set(selectedWords.map(w => w.text.toLowerCase()));
    const relatedTexts = new Set<string>();
    for (const word of selectedWords) {
      for (const rw of word.relatedWords || []) {
        if (!selectedTexts.has(rw.text.toLowerCase())) {
          relatedTexts.add(rw.text.toLowerCase());
        }
      }
    }
    return relatedTexts.size;
  }, [words, selectedWordIds]);

  // 从服务器加载单词和标签配置
  const loadData = async () => {
    try {
      const [loadedWords, loadedTagConfigs] = await Promise.all([
        storage.loadWords(),
        storage.loadTagConfigs(),
      ]);
      setWords(loadedWords);
      setAllTagConfigs(loadedTagConfigs);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 保存单词
  const handleSaveWord = async (wordData: {
    text: string;
    meanings: Meaning[];
    tags: WordTag[];
    relatedWords?: RelatedWord[];
  }) => {
    try {
      const savedWord = await saveWordAction(wordData);

      setWords(prev => {
        const existingIndex = editingWord
          ? prev.findIndex(w => w.id === editingWord.id)
          : prev.findIndex(w => w.text === wordData.text);

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = savedWord;
          return updated;
        } else {
          return [...prev, savedWord];
        }
      });

      // 刷新数据以确保与服务器一致
      await loadData();
    } catch (error) {
      console.error('保存单词失败:', error);
    } finally {
      setEditingWord(undefined);
    }
  };

  const handleDeleteWord = async (id: number) => {
    try {
      await deleteWordsAction([id]);
      setWords(prev => prev.filter(w => w.id !== id));
      setSelectedWordIds(prev => prev.filter(wordId => wordId !== id));
    } catch (error) {
      console.error('删除单词失败:', error);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedWordIds.length === 0) return;

    try {
      await deleteWordsAction(selectedWordIds);
      setWords(prev => prev.filter(w => !selectedWordIds.includes(w.id)));
      setSelectedWordIds([]);
    } catch (error) {
      console.error('删除单词失败:', error);
    } finally {
      setShowDeleteConfirm(false);
    }
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

  const handleSelectQuestionType = (options: QuestionGenerationOptions) => {
    setShowAISelector(false);

    // 获取选中单词的完整信息
    const selectedWords = words.filter(w => selectedWordIds.includes(w.id));

    // 计算需要的单词数量
    let neededCount: number;
    if (options.type === 'fill-blank') {
      const fillBlankOptions = options.fillBlank ?? { n: 5, m: 0 };
      neededCount = fillBlankOptions.n + fillBlankOptions.m;
    } else if (options.type === 'translate') {
      const translateOptions = options.translate ?? { n: 5 };
      neededCount = translateOptions.n;
    } else if (options.type === 'meaning-select') {
      const meaningSelectOptions = options.meaningSelect ?? { n: 5 };
      neededCount = meaningSelectOptions.n ?? 5;
    } else if (options.type === 'meaning-select-en') {
      const meaningSelectEnOptions = options.meaningSelectEn ?? { n: 5 };
      neededCount = meaningSelectEnOptions.n ?? 5;
    } else if (options.type === 'definition-fill-blank') {
      const definitionFillBlankOptions = options.definitionFillBlank ?? { n: 5, m: 0 };
      neededCount = definitionFillBlankOptions.n + definitionFillBlankOptions.m;
    } else if (options.type === 'word-select-translate') {
      const wordSelectTranslateOptions = options.wordSelectTranslate ?? { n: 5, m: 0 };
      neededCount = wordSelectTranslateOptions.n + wordSelectTranslateOptions.m;
    } else {
      neededCount = 5;
    }

    // 使用抽词逻辑获取需要的单词 ID 列表和关联词信息
    const { wordIds, relatedWordEntries } = selectWordsForQuestion(
      selectedWords, neededCount, options.includeRelatedWords
    );

    createQuestionAndProcess(options, wordIds, relatedWordEntries);
  };

  // 创建题目并跳转到题目页面
  const createQuestionAndProcess = async (options: QuestionGenerationOptions, wordIds: number[], relatedWordEntries: RelatedWordEntry[]) => {
    try {
      // 1. 先创建占位题目（GENERATING 状态），让用户能在队列中看到"生成中"
      const fillBlankOptions = options.type === 'fill-blank'
        ? (options.fillBlank ?? { n: 5, m: 0 })
        : { n: 5, m: 0 };

      let pendingItem;
      let questionType: QuestionType;
      switch (options.type) {
        case 'fill-blank': {
          pendingItem = await enqueuePendingFillBlank(wordIds, fillBlankOptions, options.deepThinking, relatedWordEntries);
          questionType = 'fill-blank';
          break;
        }
        case 'translate': {
          const translateOptions = options.translate ?? { n: 5 };
          pendingItem = await enqueuePendingTranslate(wordIds, translateOptions, options.deepThinking, relatedWordEntries);
          questionType = 'translate';
          break;
        }
        case 'meaning-select': {
          pendingItem = await enqueuePendingMeaningSelect(wordIds, options.deepThinking, relatedWordEntries);
          questionType = 'meaning-select';
          break;
        }
        case 'meaning-select-en': {
          pendingItem = await enqueuePendingMeaningSelectEn(wordIds, options.deepThinking, relatedWordEntries);
          questionType = 'meaning-select-en';
          break;
        }
        case 'definition-fill-blank': {
          const definitionFillBlankOptions = options.definitionFillBlank ?? { n: 5, m: 0 };
          pendingItem = await enqueuePendingDefinitionFillBlank(wordIds, definitionFillBlankOptions, options.deepThinking, relatedWordEntries);
          questionType = 'definition-fill-blank';
          break;
        }
        case 'word-select-translate': {
          const wordSelectTranslateOptions = options.wordSelectTranslate ?? { n: 5, m: 0 };
          pendingItem = await enqueuePendingWordSelectTranslate(wordIds, wordSelectTranslateOptions, options.deepThinking, relatedWordEntries);
          questionType = 'word-select-translate';
          break;
        }
      }

      // 2. 跳转到题目页面，practice 页面会根据 sessionStorage 中的 pendingQuestions
      //    触发 AI 生成，同时自动刷新队列以获取 GENERATING 状态。
      const pendingItemData = {
        questionId: pendingItem.id,
        questionType,
        wordIds,
        options,
        relatedWordEntries,
      };
      const existing = JSON.parse(sessionStorage.getItem('pendingQuestions') || '[]');
      existing.push(pendingItemData);
      sessionStorage.setItem('pendingQuestions', JSON.stringify(existing));

      router.push('/practice');
    } catch (error) {
      console.error('创建题目异常:', error);
    }
  };

  // 处理标签点击 - 用于快速筛选
  const handleTagClick = (clickedTag: WordTag, isAdditive: boolean) => {
    if (!filterTags.includes(clickedTag)) {
      setFilterTags([clickedTag]);
      setFilterLogic('or');
    } else if (isAdditive) {
      setFilterTags(prev => prev.filter(t => t !== clickedTag));
    } else {
      setFilterLogic(prev => prev === 'and' ? 'or' : 'and');
    }
  };

  // 加载中状态
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  // 如果未登录或尚未完成客户端初始化，显示未登录页面
  if (!isLoggedIn || !isClient) {
    return <UnauthenticatedPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 导航栏 */}
      <Navbar currentPage="wordbook" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              我的单词本
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 truncate">
              共 {words.length} 个单词，{filteredAndSortedWords.length} 个符合条件
            </p>
          </div>

          <button
            onClick={() => {
              setEditingWord(undefined);
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1 sm:gap-2 transition-colors text-sm sm:text-base"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">添加单词</span>
            <span className="sm:hidden">添加</span>
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 mx-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                确认删除
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6">
                确定要删除选中的 {selectedWordIds.length} 个单词吗？此操作不可恢复。
              </p>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full sm:w-auto px-4 py-2 text-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
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
        allWords={words}
        queryWord={queryWord}
        allTagConfigs={allTagConfigs}
        onTagsUpdate={handleTagsUpdate}
        onWordAdded={loadData}
      />

      {/* AI 出题类型选择器 */}
      <AIQuestionTypeSelector
        isOpen={showAISelector}
        onClose={() => setShowAISelector(false)}
        onGenerate={handleSelectQuestionType}
        maxWords={selectedWordIds.length}
        relatedWordsCount={relatedWordsCount}
      />
    </div>
  );
};

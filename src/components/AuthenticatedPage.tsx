'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, ChevronDown, ArrowLeft, BookOpen, FolderMinus } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { WordToolbar } from '@/components/WordToolbar';
import { WordPagination, PAGE_SIZE_OPTIONS } from '@/components/WordPagination';
import { WordCard } from '@/components/WordCard';
import { WordModal } from '@/components/WordModal';
import { AIQuestionTypeSelector, type QuestionGenerationOptions } from '@/components/AIQuestionTypeSelector';
import {
  QuestionType,
  Word,
  WordTag,
  TagConfig,
  RelatedWord,
  Wordbook,
} from '@/types/word';
import { DictionaryEntry, Meaning } from '@/types/dict';
import { storage } from '@/lib/storage';
import { saveWord as saveWordAction, deleteWords as deleteWordsAction, updateWordTags as updateWordTagsAction } from '@/actions/words';
import { loadWordbooks, removeWordsFromWordbook } from '@/actions/wordbooks';
import {
  enqueuePendingFillBlank,
  enqueuePendingTranslate,
  enqueuePendingMeaningSelect,
  enqueuePendingMeaningSelectEn,
  enqueuePendingDefinitionFillBlank,
  enqueuePendingWordSelectTranslate,
  createWordCardQuestion,
} from '@/actions/ai-question';
import { selectWordsForQuestion, type RelatedWordEntry } from '@/lib/word-selection';
import { generateWordbookPdf } from '@/lib/pdf-generator';
import { fuzzySearchWords } from '@/lib/word-search';
import { useRouter } from 'next/navigation';
import { getBatchReviewStates } from '@/actions/review';
import { forgettingWeight, errorWeight, totalWeight } from '@/lib/spaced-repetition/weights';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface AuthenticatedPageProps {
  queryWord: (word: string) => Promise<DictionaryEntry | null>;
  wordbookId?: number;
  wordbookName?: string;
  readOnly?: boolean;
}

export const AuthenticatedPage = ({ queryWord, wordbookId, wordbookName, readOnly = false }: AuthenticatedPageProps) => {
  const { isLoggedIn, isClient, isLoading } = useAuth();
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
  const [exportingWords, setExportingWords] = useState(false);
  const [rangeSelectMode, setRangeSelectMode] = useState(false);
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const rangeFirstEndpoint = useRef<number | null>(null);
  const rangeSelectModeRef = useRef(false);
  const [wordReviewStates, setWordReviewStates] = useState<Map<number, { lastReviewedAt: Date | null; interval: number; errorCount: number }>>(new Map());
  const [allWordbooks, setAllWordbooks] = useState<Wordbook[]>([]);
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
      const [loadedWords, loadedTagConfigs, loadedWordbooks] = await Promise.all([
        storage.loadWords(wordbookId),
        storage.loadTagConfigs(),
        loadWordbooks(),
      ]);
      setWords(loadedWords);
      setAllTagConfigs(loadedTagConfigs);
      setAllWordbooks(loadedWordbooks);
      // 加载所有单词的复习状态（用于计算并展示权重）
      try {
        const wordIds = loadedWords.map(w => w.id);
        if (wordIds.length > 0) {
          const states = await getBatchReviewStates(wordIds);
          const map = new Map<number, { lastReviewedAt: Date | null; interval: number; errorCount: number }>();
          for (const s of states) {
            map.set(s.wordId, {
              lastReviewedAt: s.lastReviewedAt ? new Date(s.lastReviewedAt) : null,
              interval: s.interval,
              errorCount: s.errorCount,
            });
          }
          setWordReviewStates(map);
        }
      } catch (e) {
        console.error('加载复习状态失败:', e);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 从本地读取用户偏好的每页数量
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wordbook-page-size');
      if (saved) {
        const parsed = Number(saved);
        if (PAGE_SIZE_OPTIONS.includes(parsed)) {
          setPageSize(parsed);
        }
      }
    } catch {
      // 忽略读取失败
    }
  }, []);

  // 筛选/排序/每页数量变化时回到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTags, filterLogic, sortBy, pageSize, wordbookId]);

  // 保存单词
  const handleSaveWord = async (wordData: {
    text: string;
    meanings: Meaning[];
    tags: WordTag[];
    relatedWords?: RelatedWord[];
  }) => {
    try {
      const savedWord = await saveWordAction({ ...wordData, wordbookId, replaceMeanings: !!editingWord });

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

  // 处理批量设置标签
  const handleSetTags = async (tags: WordTag[]) => {
    if (selectedWordIds.length === 0) return;

    try {
      const updatedWords = await updateWordTagsAction(selectedWordIds, tags);

      // 更新本地状态
      setWords(prev => {
        const updated = [...prev];
        for (const updatedWord of updatedWords) {
          const index = updated.findIndex(w => w.id === updatedWord.id);
          if (index >= 0) {
            updated[index] = updatedWord;
          }
        }
        return updated;
      });

      // 清空选中
      setSelectedWordIds([]);
    } catch (error) {
      console.error('批量设置标签失败:', error);
    }
  };

  // 将选中单词移出当前单词本（不删除单词本身）
  const handleRemoveFromWordbook = async () => {
    if (!wordbookId || selectedWordIds.length === 0) return;
    const ids = [...selectedWordIds];
    try {
      await removeWordsFromWordbook(wordbookId, ids);
      setWords(prev => prev.filter(w => !ids.includes(w.id)));
      setSelectedWordIds([]);
      const books = await loadWordbooks();
      setAllWordbooks(books);
    } catch (error) {
      console.error('移出单词本失败:', error);
    }
  };

  // 筛选和排序单词
  const filteredAndSortedWords = useMemo(() => {
    let filtered = words;

    // 搜索筛选
    if (searchTerm.trim()) {
      filtered = fuzzySearchWords(filtered, searchTerm, allTagConfigs);
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
  }, [words, searchTerm, filterTags, filterLogic, sortBy, allTagConfigs]);

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedWords.length / pageSize));
  // 当总数减少导致当前页越界时，回退到最后一页（派生值，避免与“回到第一页”的副作用冲突）
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedWords = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedWords.slice(start, start + pageSize);
  }, [filteredAndSortedWords, safeCurrentPage, pageSize]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    try {
      localStorage.setItem('wordbook-page-size', String(size));
    } catch {
      // 忽略写入失败
    }
  };

  // 处理选择 — 使用 rangeSelectModeRef 以避免闭包陈旧
  const handleToggleSelect = useCallback((id: number) => {
    if (rangeSelectModeRef.current) {
      // 区间选择模式：记录端点
      const currentIndex = filteredAndSortedWords.findIndex(w => w.id === id);
      if (currentIndex === -1) return;

      if (rangeFirstEndpoint.current === null) {
        // 第一个端点
        rangeFirstEndpoint.current = currentIndex;
        // 高亮当前卡片
        setSelectedWordIds(prev =>
          prev.includes(id) ? prev : [...prev, id]
        );
      } else {
        // 第二个端点
        const start = Math.min(rangeFirstEndpoint.current, currentIndex);
        const end = Math.max(rangeFirstEndpoint.current, currentIndex);
        const rangeIds = filteredAndSortedWords.slice(start, end + 1).map(w => w.id);

        setSelectedWordIds(prev => {
          const allSelected = rangeIds.every(rid => prev.includes(rid));
          if (allSelected) {
            return prev.filter(rid => !rangeIds.includes(rid));
          } else {
            const newSet = new Set(prev);
            rangeIds.forEach(rid => newSet.add(rid));
            return Array.from(newSet);
          }
        });

        setRangeSelectMode(false);
        rangeSelectModeRef.current = false;
        rangeFirstEndpoint.current = null;
      }
    } else {
      // 普通点击：单选切换
      setSelectedWordIds(prev =>
        prev.includes(id) ? prev.filter(wordId => wordId !== id) : [...prev, id]
      );
    }
  }, [filteredAndSortedWords]);

  const handleRangeSelectToggle = useCallback(() => {
    if (rangeSelectModeRef.current) {
      rangeSelectModeRef.current = false;
      setRangeSelectMode(false);
      rangeFirstEndpoint.current = null;
    } else {
      rangeSelectModeRef.current = true;
      setRangeSelectMode(true);
      rangeFirstEndpoint.current = null;
    }
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (selectedWordIds.length === filteredAndSortedWords.length) {
      setSelectedWordIds([]);
    } else {
      setSelectedWordIds(filteredAndSortedWords.map(w => w.id));
    }
    // 退出区间选择模式
    setRangeSelectMode(false);
    rangeSelectModeRef.current = false;
    rangeFirstEndpoint.current = null;
  }, [filteredAndSortedWords, selectedWordIds.length]);

  const handleAIGenerate = () => {
    if (selectedWordIds.length === 0) return;
    setShowAISelector(true);
  };

  const handleExportSelectedWords = async () => {
    if (selectedWordIds.length === 0 || exportingWords) return;

    const selectedSet = new Set(selectedWordIds);
    const visibleSelectedWords = filteredAndSortedWords.filter(word => selectedSet.has(word.id));
    const visibleSelectedIds = new Set(visibleSelectedWords.map(word => word.id));
    const hiddenSelectedWords = words.filter(word =>
      selectedSet.has(word.id) && !visibleSelectedIds.has(word.id)
    );
    const selectedWords = [...visibleSelectedWords, ...hiddenSelectedWords];

    setExportingWords(true);
    try {
      await generateWordbookPdf(selectedWords);
    } catch (error) {
      console.error('导出单词本 PDF 失败:', error);
      alert('导出单词本 PDF 失败，请稍后重试');
    } finally {
      setExportingWords(false);
    }
  };
  // 单词卡片直接生成（不需要 AI）
  const handleCreateWordCard = async (selectedWords: Word[], includeRelatedWords?: boolean, useSpacedRepetition?: boolean, cardCount?: number) => {
    try {
      const neededCount = Math.max(
        1,
        Math.min(cardCount ?? selectedWords.length, selectedWords.length)
      );
      const { wordIds, relatedWordEntries } = await selectWordsForQuestion(
        selectedWords, neededCount, includeRelatedWords, useSpacedRepetition
      );
      const result = await createWordCardQuestion(wordIds, relatedWordEntries);
      router.push(`/practice/${result.id}`);
    } catch (error) {
      console.error('创建单词卡片异常:', error);
    }
  };

  const handleSelectQuestionType = async (options: QuestionGenerationOptions) => {
    setShowAISelector(false);

    // 获取选中单词的完整信息
    const selectedWords = words.filter(w => selectedWordIds.includes(w.id));

    // 单词卡片直接生成，不需要 AI
    if (options.type === 'word-card') {
      handleCreateWordCard(
        selectedWords,
        options.includeRelatedWords,
        options.useSpacedRepetition,
        options.wordCard?.n
      );
      return;
    }

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

    // 使用抽词逻辑获取需要的单词 ID 列表和关联词信息（加权抽样：遗忘曲线 × 错误权重）
    const { wordIds, relatedWordEntries } = await selectWordsForQuestion(
      selectedWords, neededCount, options.includeRelatedWords, options.useSpacedRepetition
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
          pendingItem = await enqueuePendingMeaningSelect(wordIds, options.meaningSelect, options.deepThinking, relatedWordEntries);
          questionType = 'meaning-select';
          break;
        }
        case 'meaning-select-en': {
          pendingItem = await enqueuePendingMeaningSelectEn(wordIds, options.meaningSelectEn, options.deepThinking, relatedWordEntries);
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
        default: {
          throw new Error(`不支持的题目类型: ${options.type}`);
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

      router.push(`/practice/${pendingItem.id}`);
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

  // 等待登录态校验完成，避免闪现未登录页面
  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  // 未登录
  if (!isLoggedIn) {
    return <UnauthenticatedPage />;
  }

  // 加载中状态
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 导航栏 */}
      <Navbar currentPage="wordbook" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* 标题栏 */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/wordbooks"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            我的单词本
          </Link>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {wordbookName || '我的单词本'}
                </h1>
                {wordbookId !== undefined && allWordbooks.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label="切换单词本"
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {allWordbooks.map((book) => (
                        <DropdownMenuItem
                          key={book.id}
                          onClick={() => {
                            if (book.id !== wordbookId) {
                              router.push(`/wordbooks/${book.id}`);
                            }
                          }}
                        >
                          <BookOpen className="h-4 w-4" />
                          <span className="truncate flex-1">{book.name}</span>
                          <span className="text-xs text-gray-400">{book.wordCount}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 truncate">
                共 {words.length} 个单词，{filteredAndSortedWords.length} 个符合条件
              </p>
            </div>

            {!readOnly && (
              <button
                onClick={() => {
                  setEditingWord(undefined);
                  setShowModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1 sm:gap-2 transition-colors text-sm sm:text-base shrink-0"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">添加单词</span>
                <span className="sm:hidden">添加</span>
              </button>
            )}
          </div>
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
          rangeSelectMode={rangeSelectMode}
          onToggleSelectAll={handleToggleSelectAll}
          onRangeSelectToggle={handleRangeSelectToggle}
          onSort={setSortBy}
          onFilterChange={(tags, logic) => {
            setFilterTags(tags);
            setFilterLogic(logic);
          }}
          onTagConfigsUpdate={handleTagsUpdate}
          onAIGenerate={handleAIGenerate}
          onExportSelected={handleExportSelectedWords}
          onDeleteSelected={() => setShowDeleteConfirm(true)}
          isExportingSelected={exportingWords}
          onSearchChange={setSearchTerm}
          onSetTags={handleSetTags}
          onRemoveFromWordbook={wordbookId !== undefined && !readOnly ? handleRemoveFromWordbook : undefined}
          readOnly={readOnly}
        />

        {/* 确认删除弹窗 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 mx-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                确认删除
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6">
                确定要删除选中的 {selectedWordIds.length} 个单词吗？这些单词会
                <span className="font-semibold text-red-600 dark:text-red-400">
                  从所有单词本中一并删除
                </span>
                ，此操作不可恢复。
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
            {words.length === 0 && !readOnly && (
              <button
                onClick={() => setShowModal(true)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                点击添加第一个单词
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedWords.map((word) => {
                const state = wordReviewStates.get(word.id) ?? null;
                const now = new Date();
                const f = state ? forgettingWeight(state, now) : 1.0;
                const g = state ? errorWeight(state.errorCount) : 1.0;
                const w = totalWeight(state, now);
                return (
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
                    weights={{ total: w, forgetting: f, error: g }}
                    readOnly={readOnly}
                  />
                );
              })}
            </div>

            <WordPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={filteredAndSortedWords.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </div>

      {/* 添加/编辑单词弹窗 */}
      <WordModal
        key={editingWord?.id ?? 'new'}
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

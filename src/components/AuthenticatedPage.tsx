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
import { QuestionPanel } from '@/components/QuestionPanel';
import { Word, WordTag, TagConfig, RelatedWord, QuestionQueueItem, QuestionStatus } from '@/types/word';
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
  const [loading, setLoading] = useState(true);
  const [questionQueue, setQuestionQueue] = useState<QuestionQueueItem[]>([]);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [processing, setProcessing] = useState(false);

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
    meanings: {
      content: string;
      type: string;
      sentence: string;
    }[];
    tags: WordTag[];
    relatedWords?: RelatedWord[];
  }) => {
    try {
      const response = await fetch('/api/words', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wordData),
      });

      if (!response.ok) return;

      const savedWord = await response.json();

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
      const response = await fetch(`/api/words?ids=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setWords(prev => prev.filter(w => w.id !== id));
        setSelectedWordIds(prev => prev.filter(wordId => wordId !== id));
      }
    } catch (error) {
      console.error('删除单词失败:', error);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedWordIds.length === 0) return;

    try {
      const response = await fetch(`/api/words?ids=${selectedWordIds.join(',')}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setWords(prev => prev.filter(w => !selectedWordIds.includes(w.id)));
        setSelectedWordIds([]);
      }
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

  const handleSelectQuestionType = (type: AIQuestionType) => {
    setShowAISelector(false);
    createQuestionAndProcess(type, [...selectedWordIds]);
  };

  // 创建题目并触发 AI 生成
  const createQuestionAndProcess = async (type: AIQuestionType, wordIds: number[]) => {
    try {
      const res = await fetch('/api/ai-question', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionType: type, wordIds }),
      });

      if (!res.ok) {
        console.error('创建题目失败:', await res.text());
        return;
      }

      setShowQueuePanel(true);

      // 自动触发 AI 生成（处理队列头）
      await processQuestion();
    } catch (error) {
      console.error('AI 出题异常:', error);
    }
  };

  // 加载题目队列
  const loadQuestionQueue = async () => {
    try {
      const res = await fetch('/api/ai-question', {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setQuestionQueue(data);
      }
    } catch (error) {
      console.error('加载题目队列失败:', error);
    }
  };

  // 触发 AI 生成（处理队列头）
  const processQuestion = async (questionId?: string) => {
    try {
      setProcessing(true);
      const processRes = await fetch('/api/ai-question/process', {
        method: 'GET',
        credentials: 'include',
      });

      if (!processRes.ok) {
        console.error('AI 生成失败:', await processRes.text());
      } else {
        await loadQuestionQueue();
      }
    } catch (error) {
      console.error('AI 出题异常:', error);
    } finally {
      setProcessing(false);
    }
  };

  // 提交作答
  const handleSubmitAnswer = async (questionId: string, answers: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/ai-question/${questionId}/answer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (res.ok) {
        await loadQuestionQueue();
      } else {
        console.error('提交作答失败:', await res.text());
      }
    } catch (error) {
      console.error('提交作答异常:', error);
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1 sm:gap-2 transition-colors text-sm sm:text-base flex-shrink-0"
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
      />

      {/* AI 出题类型选择器 */}
      <AIQuestionTypeSelector
        isOpen={showAISelector}
        onClose={() => setShowAISelector(false)}
        onSelectType={handleSelectQuestionType}
      />

      {/* AI 出题队列面板 */}
      <QuestionPanel
        queue={questionQueue}
        isOpen={showQueuePanel}
        onClose={() => setShowQueuePanel(false)}
        onProcess={processQuestion}
        onSubmitAnswer={handleSubmitAnswer}
        processing={processing}
      />
    </div>
  );
};

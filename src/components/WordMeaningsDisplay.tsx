'use client';

import { useEffect, useState } from 'react';
import { getQuestionWordMeanings, type QuestionWordMeaning } from '@/actions/ai-question';
import {
  updateWordMeanings,
  getWordWordbooks,
  removeWordFromWordbooks,
  deleteWords,
  type WordWordbook,
} from '@/actions/words';
import { Meaning } from '@/types/dict';
import { Pencil, Trash2, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface WordMeaningsDisplayProps {
  questionId: string;
  status: string;
  isShowingResults?: boolean;
}

export function WordMeaningsDisplay({ questionId, status, isShowingResults }: WordMeaningsDisplayProps) {
  const [wordMeanings, setWordMeanings] = useState<QuestionWordMeaning[]>([]);
  const [deletedWordCount, setDeletedWordCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 编辑释义相关状态
  const [editingWord, setEditingWord] = useState<QuestionWordMeaning | null>(null);
  const [draftMeanings, setDraftMeanings] = useState<Meaning[]>([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 删除单词相关状态
  const [deletingWord, setDeletingWord] = useState<QuestionWordMeaning | null>(null);
  const [wordWordbooks, setWordWordbooks] = useState<WordWordbook[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<number[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const shouldShow = status === 'ANSWERED' || isShowingResults;

  useEffect(() => {
    if (!shouldShow) return;

    setLoading(true);
    setError(null);
    getQuestionWordMeanings(questionId)
      .then(data => {
        setWordMeanings(data.words);
        setDeletedWordCount(data.deletedWordCount);
      })
      .catch(err => {
        console.error('获取单词释义失败:', err);
        setError('获取单词释义失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [questionId, shouldShow]);

  const openEdit = (word: QuestionWordMeaning) => {
    if (word.wordId === undefined) return;
    setEditingWord(word);
    setDraftMeanings(
      word.meanings.length > 0
        ? word.meanings.map(m => ({ ...m }))
        : [{ content: '', type: '' }]
    );
    setEditError(null);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditingWord(null);
    setDraftMeanings([]);
    setEditError(null);
  };

  const updateDraft = (index: number, field: 'type' | 'content', value: string) => {
    setDraftMeanings(prev =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const addDraftMeaning = () => {
    setDraftMeanings(prev => [...prev, { content: '', type: '' }]);
  };

  const removeDraftMeaning = (index: number) => {
    setDraftMeanings(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveMeanings = async () => {
    if (!editingWord?.wordId) return;

    const cleaned: Meaning[] = draftMeanings
      .map(m => ({
        content: (m.content ?? '').trim(),
        type: (m.type ?? '').trim(),
        ...(m.sentence ? { sentence: m.sentence } : {}),
      }))
      .filter(m => m.content.length > 0);

    setSaving(true);
    setEditError(null);
    try {
      await updateWordMeanings(editingWord.wordId, cleaned);
      setWordMeanings(prev =>
        prev.map(w => (w.wordId === editingWord.wordId ? { ...w, meanings: cleaned } : w))
      );
      setEditingWord(null);
      setDraftMeanings([]);
    } catch (err) {
      console.error('更新释义失败:', err);
      setEditError('更新释义失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const openDelete = async (word: QuestionWordMeaning) => {
    if (word.wordId === undefined) return;
    setDeletingWord(word);
    setWordWordbooks([]);
    setSelectedBookIds([]);
    setDeleteError(null);
    setLoadingBooks(true);
    try {
      const books = await getWordWordbooks(word.wordId);
      setWordWordbooks(books);
      setSelectedBookIds(books.map(b => b.id));
    } catch (err) {
      console.error('加载单词本失败:', err);
      setDeleteError('加载单词本失败，请稍后重试');
    } finally {
      setLoadingBooks(false);
    }
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeletingWord(null);
    setWordWordbooks([]);
    setSelectedBookIds([]);
    setDeleteError(null);
  };

  const toggleBook = (bookId: number, checked: boolean) => {
    setSelectedBookIds(prev =>
      checked ? Array.from(new Set([...prev, bookId])) : prev.filter(id => id !== bookId)
    );
  };

  const selectAllBooks = () => setSelectedBookIds(wordWordbooks.map(b => b.id));
  const deselectAllBooks = () => setSelectedBookIds([]);

  const removeFromList = (wordId: number) => {
    setWordMeanings(prev => prev.filter(w => w.wordId !== wordId));
  };

  const handleConfirmDelete = async () => {
    if (!deletingWord?.wordId) return;
    if (selectedBookIds.length === 0) {
      setDeleteError('请至少选择一个单词本');
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await removeWordFromWordbooks(deletingWord.wordId, selectedBookIds);
      if (result.removed > 0 || result.wordDeleted) {
        removeFromList(deletingWord.wordId);
        setDeletingWord(null);
        setWordWordbooks([]);
        setSelectedBookIds([]);
      } else {
        setDeleteError('删除失败：所选单词本中不包含该单词');
      }
    } catch (err) {
      console.error('删除单词失败:', err);
      setDeleteError('删除单词失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteOrphanWord = async () => {
    if (!deletingWord?.wordId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteWords([deletingWord.wordId]);
      removeFromList(deletingWord.wordId);
      setDeletingWord(null);
    } catch (err) {
      console.error('删除单词失败:', err);
      setDeleteError('删除单词失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  if (!shouldShow) return null;

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">加载单词释义中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (wordMeanings.length === 0 && deletedWordCount === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-3">
        本次练习涉及的单词及释义
      </h3>

      {deletedWordCount > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <Trash2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            原题涉及的 {deletedWordCount} 个单词已从单词本中删除，未在此列出。
          </span>
        </div>
      )}

      <div className="space-y-2">
        {wordMeanings.map((word, index) => (
          <div key={index} className="flex flex-wrap items-start gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[80px]">
              {word.text}
              {word.isRelatedWord && word.sourceWords && word.sourceWords.length > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  ({word.sourceWords.join('、')}的关联词)
                </span>
              )}
              :
            </span>
            <div className="flex flex-wrap gap-1 flex-1">
              {word.meanings.length > 0 ? (
                word.meanings.map((meaning, mIndex) => (
                  <span
                    key={mIndex}
                    className="text-xs px-2 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600"
                  >
                    {meaning.type && (
                      <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1">
                        {meaning.type}
                      </span>
                    )}
                    {meaning.content}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">暂无释义</span>
              )}
            </div>
            {word.wordId !== undefined && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(word)}
                  title="编辑释义"
                  aria-label="编辑释义"
                  className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => openDelete(word)}
                  title="删除单词"
                  aria-label="删除单词"
                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 dark:hover:text-red-300 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 编辑释义对话框 */}
      <Dialog open={!!editingWord} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑释义</DialogTitle>
            <DialogDescription>
              修改「{editingWord?.text}」的释义，保存后将同步到单词本。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {draftMeanings.map((meaning, index) => (
              <div key={index} className="flex items-start gap-2">
                <Input
                  value={meaning.type ?? ''}
                  onChange={(e) => updateDraft(index, 'type', e.target.value)}
                  placeholder="词性"
                  className="w-20 shrink-0"
                />
                <Input
                  value={meaning.content ?? ''}
                  onChange={(e) => updateDraft(index, 'content', e.target.value)}
                  placeholder="释义内容"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMeanings(); }}
                />
                <button
                  type="button"
                  onClick={() => removeDraftMeaning(index)}
                  title="删除该释义"
                  aria-label="删除该释义"
                  className="p-2 rounded text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 dark:hover:text-red-300 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addDraftMeaning}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              添加释义
            </button>

            {editError && (
              <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSaveMeanings} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除单词对话框：选择要删除的单词本 */}
      <Dialog open={!!deletingWord} onOpenChange={(open) => { if (!open) closeDelete(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除单词</DialogTitle>
            <DialogDescription>
              选择要从哪些单词本中删除「{deletingWord?.text}」。
            </DialogDescription>
          </DialogHeader>

          {loadingBooks ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">正在加载单词本...</p>
          ) : wordWordbooks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              该单词不属于任何单词本，可直接删除该单词。
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  已选 {selectedBookIds.length} / {wordWordbooks.length}
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={selectAllBooks}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllBooks}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    全不选
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 rounded-md border border-gray-200 dark:border-gray-700 p-3">
                {wordWordbooks.map(book => (
                  <label
                    key={book.id}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedBookIds.includes(book.id)}
                      onCheckedChange={(checked) => toggleBook(book.id, checked === true)}
                    />
                    {book.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {deleteError && (
            <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDelete} disabled={deleting}>
              取消
            </Button>
            {wordWordbooks.length === 0 && !loadingBooks ? (
              <Button variant="destructive" onClick={handleDeleteOrphanWord} disabled={deleting}>
                {deleting ? '删除中...' : '删除单词'}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleting || loadingBooks || selectedBookIds.length === 0}
              >
                {deleting ? '删除中...' : '删除'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

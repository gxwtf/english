'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { loadReviewSettings, saveReviewSettings } from '@/actions/review-settings';
import { loadWordbooks } from '@/actions/wordbooks';
import type { Wordbook } from '@/types/word';
import type { ReviewScopeMode } from '@/types/review-settings';

interface ReviewScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReviewScopeModal({ isOpen, onClose }: ReviewScopeModalProps) {
  const [mode, setMode] = useState<ReviewScopeMode>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaved(false);

    Promise.all([loadReviewSettings(), loadWordbooks()])
      .then(([settings, books]) => {
        if (cancelled) return;
        setMode(settings.mode);
        setSelectedIds(settings.wordbookIds);
        setWordbooks(books);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载设置失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const allSelected = useMemo(
    () => wordbooks.length > 0 && selectedIds.length === wordbooks.length,
    [wordbooks, selectedIds]
  );

  const toggleWordbook = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(wordbooks.map((b) => b.id));
  };

  const handleSelectNone = () => {
    setSelectedIds([]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await saveReviewSettings({ mode, wordbookIds: selectedIds });
      if (!result.success) {
        setError(result.error || '保存失败');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            一键复习范围设置
          </DialogTitle>
          <DialogDescription>
            选择首页「一键复习」抽词时使用的单词范围。修改后立即生效。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-500 dark:text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载中...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3">
              <ScopeCard
                selected={mode === 'all'}
                onSelect={() => setMode('all')}
                icon={<Layers className="h-5 w-5" />}
                title="全部单词本"
                description="复习所有单词本中的单词（默认）"
              />
              <ScopeCard
                selected={mode === 'custom'}
                onSelect={() => setMode('custom')}
                icon={<BookOpen className="h-5 w-5" />}
                title="指定单词本"
                description="只复习下方勾选的单词本中的单词"
              />
            </div>

            {mode === 'custom' && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/60 dark:bg-gray-800/40">
                {wordbooks.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    还没有创建任何单词本
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        单词本（已选 {selectedIds.length}/{wordbooks.length}）
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          disabled={allSelected}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:text-gray-400 disabled:no-underline dark:disabled:text-gray-500"
                        >
                          全选
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectNone}
                          disabled={selectedIds.length === 0}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:text-gray-400 disabled:no-underline dark:disabled:text-gray-500"
                        >
                          全不选
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {wordbooks.map((book) => {
                        const checked = selectedIds.includes(book.id);
                        return (
                          <button
                            type="button"
                            key={book.id}
                            onClick={() => toggleWordbook(book.id)}
                            className={`w-full flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                              checked
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                checked
                                  ? 'border-blue-500 bg-blue-600 text-white'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {checked && <Check className="h-3.5 w-3.5" />}
                            </span>
                            <span className="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-white">
                              {book.name}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                              {book.wordCount} 词
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              {saved && (
                <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  已保存
                </span>
              )}
              <Button variant="outline" onClick={onClose} disabled={saving}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ScopeCardProps {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ScopeCard({ selected, onSelect, icon, title, description }: ScopeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-4 transition-all flex items-start gap-3 ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          selected
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
          {selected && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </button>
  );
}

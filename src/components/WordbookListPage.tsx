'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  BookOpen,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ArrowRight,
  Layers,
  Download,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { Wordbook, SystemWordbook } from '@/types/word';
import {
  loadWordbooks,
  createWordbook,
  renameWordbook,
  deleteWordbook,
} from '@/actions/wordbooks';
import { loadSystemWordbooks } from '@/actions/system-wordbooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const WordbookListPage = () => {
  const { isLoggedIn, isClient, isLoading } = useAuth();
  const router = useRouter();
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemWordbooks, setSystemWordbooks] = useState<SystemWordbook[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Wordbook | null>(null);
  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);

  const [deleting, setDeleting] = useState<Wordbook | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [data, systemData] = await Promise.all([
        loadWordbooks(),
        loadSystemWordbooks(),
      ]);
      setWordbooks(data);
      setSystemWordbooks(systemData);
    } catch (error) {
      console.error('加载单词本失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isClient || !isLoggedIn) return;
    loadData();
  }, [isClient, isLoggedIn, loadData]);

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormError('');
    setSelectedSystemId(null);
    setShowForm(true);
  };

  const openRename = (book: Wordbook) => {
    setEditing(book);
    setFormName(book.name);
    setFormError('');
    setSelectedSystemId(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const name = formName.trim();
    if (!name) {
      setFormError('请输入单词本名称');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await renameWordbook(editing.id, name);
      } else {
        await createWordbook(name, selectedSystemId ?? undefined);
      }
      setShowForm(false);
      await loadData();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '操作失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteWordbook(deleting.id);
      setDeleting(null);
      await loadData();
    } catch (error) {
      console.error('删除单词本失败:', error);
    } finally {
      setDeletingBusy(false);
    }
  };

  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <UnauthenticatedPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar currentPage="wordbook" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              我的单词本
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 truncate">
              共 {wordbooks.length} 个单词本
            </p>
          </div>

          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1 sm:gap-2 transition-colors text-sm sm:text-base"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">新建单词本</span>
            <span className="sm:hidden">新建</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 dark:text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载中...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              onClick={() => router.push('/wordbooks/all')}
              className="group relative bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-5 cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all flex items-center"
            >
              <div className="flex items-center gap-3 min-w-0 w-full">
                <div className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Layers className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">所有单词</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    汇总全部单词
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </div>

            {wordbooks.length === 0 && (
              <div
                onClick={openCreate}
                className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-5 cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all flex flex-col items-center justify-center text-center min-h-[120px]"
              >
                <BookOpen className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">还没有单词本，点击创建</p>
              </div>
            )}

            {wordbooks.map((book) => (
              <div
                key={book.id}
                onClick={() => router.push(`/wordbooks/${book.id}`)}
                className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                      <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {book.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {book.wordCount} 个单词
                      </p>
                    </div>
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                          aria-label="更多操作"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => openRename(book)}>
                          <Pencil className="h-4 w-4" />
                          <span>重命名</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(book)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>删除</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {book.previewWords.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-4 min-h-[26px]">
                    {book.previewWords.map((w) => (
                      <span
                        key={w}
                        className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 min-h-[26px]">
                    暂无单词
                  </p>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    更新于 {formatDate(book.updatedAt)}
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    进入
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新建/重命名弹窗 */}
      <Dialog open={showForm} onOpenChange={(open) => !saving && setShowForm(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '重命名单词本' : '新建单词本'}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <Input
              autoFocus
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                setFormError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !saving) handleSubmit();
              }}
              placeholder="请输入单词本名称"
              maxLength={50}
            />

            {!editing && systemWordbooks.length > 0 && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Download className="h-4 w-4" />
                  导入系统单词本（可选）
                </label>
                <Select
                  value={selectedSystemId ? String(selectedSystemId) : 'none'}
                  onValueChange={(v) => setSelectedSystemId(v === 'none' ? null : Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="不导入，创建空单词本" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不导入，创建空单词本</SelectItem>
                    {systemWordbooks.map((sys) => (
                      <SelectItem key={sys.id} value={String(sys.id)}>
                        {sys.name}（{sys.wordCount} 个单词）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSystemId && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    创建后将复制该系统单词本的全部单词，你可以自由编辑，不会影响系统单词本。
                  </p>
                )}
              </div>
            )}

            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && !deletingBusy && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除单词本</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400 py-2">
            确定要删除「{deleting?.name}」吗？仅属于该单词本的单词将被一并删除且不可恢复；被其他单词本共享的单词会保留。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deletingBusy}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletingBusy}
            >
              {deletingBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  Upload,
  Loader2,
  Trash2,
  BookOpen,
  FileText,
  AlertCircle,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { SystemWordbook } from '@/types/word';
import { parseWordFile, type ParsedSystemWord } from '@/lib/system-word-parse';
import {
  loadSystemWordbooksAdmin,
  createSystemWordbook,
  deleteSystemWordbook,
  updateSystemWordbook,
} from '@/actions/system-wordbooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AdminWordbooksPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { isLoggedIn, isClient, isLoading, userInfo } = useAuth();
  const isAdmin = !!userInfo && Number(userInfo.admin) > 0;

  const [wordbooks, setWordbooks] = useState<SystemWordbook[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parsedWords, setParsedWords] = useState<ParsedSystemWord[]>([]);
  const [parseError, setParseError] = useState('');
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [deleting, setDeleting] = useState<SystemWordbook | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [editing, setEditing] = useState<SystemWordbook | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await loadSystemWordbooksAdmin();
      setWordbooks(data);
    } catch (error) {
      console.error('加载系统单词本失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isClient || !isLoggedIn || !isAdmin) return;
    loadData();
  }, [isClient, isLoggedIn, isAdmin, loadData]);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setParseError('');
    setFormMessage(null);
    setFileName(file.name);
    try {
      const content = await file.text();
      const result = parseWordFile(content, file.name);
      if (result.length === 0) {
        setParsedWords([]);
        setParseError('未从文件中解析到任何单词');
        return;
      }
      setParsedWords(result);
      setPasteText('');
      if (!name.trim()) {
        setName(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch (error) {
      setParsedWords([]);
      setParseError(error instanceof Error ? error.message : '文件解析失败');
    }
  };

  const handlePasteChange = (value: string) => {
    setPasteText(value);
    setFormMessage(null);
    if (!value.trim()) {
      setParsedWords([]);
      setParseError('');
      setFileName('');
      return;
    }
    try {
      const result = parseWordFile(value, 'paste.txt');
      setParsedWords(result);
      setParseError(result.length === 0 ? '未解析到任何单词' : '');
      setFileName('');
    } catch (error) {
      setParsedWords([]);
      setParseError(error instanceof Error ? error.message : '解析失败');
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPasteText('');
    setParsedWords([]);
    setParseError('');
    setFileName('');
    setFormMessage(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setFormMessage({ type: 'error', text: '请输入系统单词本名称' });
      return;
    }
    if (parsedWords.length === 0) {
      setFormMessage({ type: 'error', text: '请先上传文件或粘贴单词列表' });
      return;
    }
    setSaving(true);
    setFormMessage(null);
    try {
      await createSystemWordbook({ name, description, words: parsedWords });
      setFormMessage({ type: 'success', text: `已创建「${name.trim()}」，共 ${parsedWords.length} 个单词` });
      resetForm();
      await loadData();
    } catch (error) {
      setFormMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '创建失败，请重试',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteSystemWordbook(deleting.id);
      setDeleting(null);
      await loadData();
    } catch (error) {
      console.error('删除系统单词本失败:', error);
    } finally {
      setDeletingBusy(false);
    }
  };

  const openEdit = (book: SystemWordbook) => {
    setEditing(book);
    setEditName(book.name);
    setEditDescription(book.description ?? '');
  };

  const handleEditSave = async () => {
    if (!editing) return;
    if (!editName.trim()) return;
    setEditBusy(true);
    try {
      await updateSystemWordbook(editing.id, { name: editName, description: editDescription });
      setEditing(null);
      await loadData();
    } catch (error) {
      console.error('更新系统单词本失败:', error);
    } finally {
      setEditBusy(false);
    }
  };

  const previewList = useMemo(() => parsedWords.slice(0, 20), [parsedWords]);

  if (!isClient || isLoading) {
    return (
      <div className={embedded ? 'py-12 text-center' : 'min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900'}>
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    if (embedded) return null;
    return <UnauthenticatedPage />;
  }

  if (!isAdmin) {
    if (embedded) {
      return (
        <div className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">无权访问：需要管理员权限</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar currentPage="admin" />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <Shield className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">无权访问：需要管理员权限</p>
        </div>
      </div>
    );
  }

  const inner = (
    <>
      <div className={embedded ? 'w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8' : 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8'}>
        {!embedded && (
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-brand-crimson" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                系统单词本管理
              </h1>
            </div>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
              上传系统单词本后，用户可以在新建单词本时导入全部单词
            </p>
          </div>
        )}

        {/* 上传表单 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Upload className="h-4 w-4" />
            上传新的系统单词本
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sys-name" className="mb-1.5 block">
                名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="sys-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：高考 3500 词"
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="sys-desc" className="mb-1.5 block">
                描述
              </Label>
              <Input
                id="sys-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选的说明"
                maxLength={200}
              />
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="sys-file" className="mb-1.5 block">单词文件</Label>
            <input
              id="sys-file"
              name="sys-file"
              type="file"
              accept=".json,.txt,.csv,.tsv,application/json,text/plain"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-crimson file:text-white hover:file:bg-brand-red cursor-pointer"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              支持 JSON（数组，字段：text/word/english、phonetic/phoneticSymbol、chinese/meaning/translation）、
              CSV/TXT（每行 <code>单词,释义</code> 或 <code>单词&#9;释义</code>）
            </p>
          </div>

          <div className="mt-4">
            <Label htmlFor="sys-paste" className="mb-1.5 block">
              或直接粘贴单词列表
            </Label>
            <Textarea
              id="sys-paste"
              value={pasteText}
              onChange={(e) => handlePasteChange(e.target.value)}
              placeholder={'apple,苹果\nabandon,v. 放弃，抛弃'}
              className="min-h-32 font-mono text-sm"
            />
          </div>

          {parseError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              {parseError}
            </p>
          )}

          {parsedWords.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                已解析 {parsedWords.length} 个单词
                {fileName && <span className="text-gray-400">（{fileName}）</span>}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {previewList.map((w) => (
                  <span
                    key={w.text}
                    className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                  >
                    {w.text}
                  </span>
                ))}
                {parsedWords.length > previewList.length && (
                  <span className="text-xs px-2 py-0.5 text-gray-400">
                    …等 {parsedWords.length} 个
                  </span>
                )}
              </div>
            </div>
          )}

          {formMessage && (
            <p
              className={`mt-3 text-sm flex items-center gap-1.5 ${
                formMessage.type === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {formMessage.text}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={handleCreate}
              disabled={saving || parsedWords.length === 0}
              className="bg-brand-crimson hover:bg-brand-red"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              创建系统单词本
            </Button>
            {(parsedWords.length > 0 || name || pasteText) && (
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                清空
              </Button>
            )}
          </div>
        </div>

        {/* 已有系统单词本 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4" />
            已有系统单词本（{wordbooks.length}）
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : wordbooks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
              还没有系统单词本
            </p>
          ) : (
            <div className="space-y-3">
              {wordbooks.map((book) => (
                <div
                  key={book.id}
                  className="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {book.name}
                      </h3>
                      {book.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {book.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {book.wordCount} 个单词 · 更新于 {formatDate(book.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(book)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(book)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {book.previewWords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {book.previewWords.map((w) => (
                        <span
                          key={w}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 删除确认 */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && !deletingBusy && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除系统单词本</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400 py-2">
            确定要删除「{deleting?.name}」吗？系统单词本及其全部单词将被永久删除，且不影响已导入到用户单词本中的副本。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletingBusy}>
              {deletingBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑 */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && !editBusy && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑系统单词本</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div>
              <Label htmlFor="edit-name" className="mb-1.5 block">
                名称
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="edit-desc" className="mb-1.5 block">
                描述
              </Label>
              <Input
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={editBusy}>
              取消
            </Button>
            <Button onClick={handleEditSave} disabled={editBusy || !editName.trim()}>
              {editBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return <div className="px-1 sm:px-2">{inner}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar currentPage="admin" />
      {inner}
    </div>
  );
}

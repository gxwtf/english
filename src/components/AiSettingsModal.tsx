'use client';

import { useEffect, useState } from 'react';
import { Bot, Check, Loader2, Server, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { loadAiSettings, saveAiSettings } from '@/actions/ai-settings';
import type { AiModelMode, AiSettings } from '@/types/ai-settings';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiSettingsModal({ isOpen, onClose }: AiSettingsModalProps) {
  const [mode, setMode] = useState<AiModelMode>('system');
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [model, setModel] = useState('');

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
    loadAiSettings()
      .then((settings: AiSettings) => {
        if (cancelled) return;
        setMode(settings.mode);
        setApiKey(settings.apiKey ?? '');
        setApiBase(settings.apiBase ?? '');
        setModel(settings.model ?? '');
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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await saveAiSettings({ mode, apiKey, apiBase, model });
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
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            AI 出题设置
          </DialogTitle>
          <DialogDescription>
            配置 AI 出题与批改所使用的大模型。修改后将应用于之后新生成的题目。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-500 dark:text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载中...
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                大模型设置
              </h3>

              <div className="grid gap-3">
                <ModeCard
                  selected={mode === 'system'}
                  onSelect={() => setMode('system')}
                  icon={<Server className="h-5 w-5" />}
                  title="使用系统提供的大模型"
                  description="由系统统一配置，开箱即用，无需填写任何参数"
                />
                <ModeCard
                  selected={mode === 'custom'}
                  onSelect={() => setMode('custom')}
                  icon={<Bot className="h-5 w-5" />}
                  title="自定义大模型"
                  description="使用你自己的 API 配置，兼容 OpenAI 接口格式"
                />
              </div>
            </div>

            {mode === 'custom' && (
              <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/60 dark:bg-gray-800/40">
                <div className="space-y-2">
                  <Label htmlFor="ai-api-key">API Key</Label>
                  <Input
                    id="ai-api-key"
                    type="password"
                    autoComplete="off"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-api-base">API Base</Label>
                  <Input
                    id="ai-api-base"
                    type="text"
                    autoComplete="off"
                    placeholder="https://api.openai.com/v1"
                    value={apiBase}
                    onChange={(e) => setApiBase(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    需要包含版本路径，例如 https://api.openai.com/v1
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-model">模型名称</Label>
                  <Input
                    id="ai-model"
                    type="text"
                    autoComplete="off"
                    placeholder="gpt-4o-mini"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
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

interface ModeCardProps {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ModeCard({ selected, onSelect, icon, title, description }: ModeCardProps) {
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

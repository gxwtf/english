'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from './auth';
import type { AiSettings } from '@/types/ai-settings';

/**
 * 读取当前用户的 AI 出题设置。
 * 未设置时返回默认（使用系统提供的大模型）。
 */
export async function loadAiSettings(): Promise<AiSettings> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const dbUser = await prisma.user.findUnique({
    where: { userId: user.userId },
    select: { aiSettings: true },
  });

  const stored = dbUser?.aiSettings as AiSettings | null | undefined;
  if (!stored || stored.mode !== 'custom') {
    return { mode: 'system' };
  }

  return {
    mode: 'custom',
    apiKey: stored.apiKey ?? '',
    apiBase: stored.apiBase ?? '',
    model: stored.model ?? '',
  };
}

/**
 * 保存当前用户的 AI 出题设置。
 */
export async function saveAiSettings(
  input: AiSettings
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: '未登录' };

  const mode = input.mode === 'custom' ? 'custom' : 'system';

  let aiSettings: AiSettings;
  if (mode === 'custom') {
    const apiKey = input.apiKey?.trim() ?? '';
    const apiBase = input.apiBase?.trim() ?? '';
    const model = input.model?.trim() ?? '';
    if (!apiKey || !apiBase || !model) {
      return { success: false, error: '请完整填写 API Key、API Base 和模型名称' };
    }
    aiSettings = { mode: 'custom', apiKey, apiBase, model };
  } else {
    aiSettings = { mode: 'system' };
  }

  try {
    await prisma.user.update({
      where: { userId: user.userId },
      data: { aiSettings: JSON.parse(JSON.stringify(aiSettings)) },
    });
  } catch (error) {
    console.error('保存 AI 出题设置失败:', error);
    return { success: false, error: '保存失败，请稍后重试' };
  }

  return { success: true };
}

'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from './auth';
import type { ReviewSettings } from '@/types/review-settings';

const DEFAULT_SETTINGS: ReviewSettings = { mode: 'all', wordbookIds: [] };

/**
 * 读取当前用户的「一键复习」范围设置。
 * 未设置时默认复习全部单词本。
 */
export async function loadReviewSettings(): Promise<ReviewSettings> {
  const user = await getAuthUser();
  if (!user) return DEFAULT_SETTINGS;

  const dbUser = await prisma.user.findUnique({
    where: { userId: user.userId },
    select: { reviewSettings: true },
  });

  const stored = dbUser?.reviewSettings as Partial<ReviewSettings> | null | undefined;
  if (!stored) return DEFAULT_SETTINGS;

  const mode = stored.mode === 'custom' ? 'custom' : 'all';
  const wordbookIds = Array.isArray(stored.wordbookIds)
    ? stored.wordbookIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id))
    : [];

  return { mode, wordbookIds };
}

/**
 * 保存当前用户的「一键复习」范围设置。
 */
export async function saveReviewSettings(
  input: ReviewSettings
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: '未登录' };

  const mode = input.mode === 'custom' ? 'custom' : 'all';
  const wordbookIds = Array.from(
    new Set(
      (input.wordbookIds ?? [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  const settings: ReviewSettings = { mode, wordbookIds };

  try {
    await prisma.user.update({
      where: { userId: user.userId },
      data: { reviewSettings: JSON.parse(JSON.stringify(settings)) },
    });
  } catch (error) {
    console.error('保存一键复习范围设置失败:', error);
    return { success: false, error: '保存失败，请稍后重试' };
  }

  return { success: true };
}

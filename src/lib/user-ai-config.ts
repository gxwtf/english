import { getAuthUser } from '@/actions/auth';
import { prisma } from '@/lib/db';
import type { ModelConfig } from '@/lib/openai';
import type { AiSettings } from '@/types/ai-settings';

/**
 * 读取当前登录用户自定义的大模型配置。
 * 返回 null 表示未登录、未启用自定义模型或配置不完整（此时应回退到系统模型）。
 *
 * 注意：该函数依赖请求上下文中的 session cookie，仅在服务端请求作用域内可用。
 */
export async function loadUserModelConfigs(): Promise<ModelConfig[] | null> {
  try {
    const user = await getAuthUser();
    if (!user) return null;

    const dbUser = await prisma.user.findUnique({
      where: { userId: user.userId },
      select: { aiSettings: true },
    });

    const settings = dbUser?.aiSettings as AiSettings | null | undefined;
    if (!settings || settings.mode !== 'custom') return null;
    if (!settings.apiKey || !settings.apiBase || !settings.model) return null;

    return [
      {
        name: 'user-custom',
        model: settings.model,
        apiKey: settings.apiKey,
        apiBase: settings.apiBase,
      },
    ];
  } catch (error) {
    console.warn('读取用户自定义大模型配置失败，回退到系统模型:', error);
    return null;
  }
}

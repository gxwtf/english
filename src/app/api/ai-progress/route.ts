import { NextRequest, NextResponse } from 'next/server';
import { getAIProgress } from '@/lib/ai-progress';

export const dynamic = 'force-dynamic';

/**
 * 读取 AI 进度（供客户端轮询）。
 * 使用 Route Handler 而非 Server Action，避免与长时间运行的
 * 出题 / 批改 Server Action 相互排队阻塞。
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ progress: null });
  }
  return NextResponse.json({ progress: getAIProgress(key) });
}

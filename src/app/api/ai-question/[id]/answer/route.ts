// API 路由：提交题目作答
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function getUserFromCookie(request: NextRequest) {
  const authCookie = request.cookies.get('gxwtf_auth');
  if (!authCookie) return null;
  try {
    const userInfo = JSON.parse(authCookie.value);
    return { userId: userInfo.userId, userName: userInfo.userName, admin: userInfo.admin };
  } catch {
    return null;
  }
}

// POST - 提交作答
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { answers } = body;

    if (!answers) {
      return NextResponse.json({ error: '缺少作答内容' }, { status: 400 });
    }

    // 验证题目属于当前用户且已生成
    const question = await prisma.questionQueue.findUnique({
      where: { id },
    });

    if (!question) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 });
    }

    if (question.userId !== user.userId) {
      return NextResponse.json({ error: '无权访问此题目' }, { status: 403 });
    }

    if (question.status !== 'GENERATED') {
      return NextResponse.json({ error: '题目尚未生成完毕或已作答' }, { status: 400 });
    }

    // 保存作答并更新状态
    const updated = await prisma.questionQueue.update({
      where: { id },
      data: {
        lastAnswer: answers as object,
        status: 'ANSWERED',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('提交作答失败:', error);
    return NextResponse.json({ error: '提交失败' }, { status: 500 });
  }
}

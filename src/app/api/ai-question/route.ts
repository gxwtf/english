// API 路由：AI 出题队列管理
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { QuestionType, QuestionStatus } from '@/types/word';

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

// GET - 获取当前用户的题目队列
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const questions = await prisma.questionQueue.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error('获取题目队列失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST - 创建新题目（加入队列）
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { questionType, wordIds } = body;

    if (!questionType || !wordIds?.length) {
      return NextResponse.json({ error: '缺少题目类型或单词列表' }, { status: 400 });
    }

    if (!['fill-blank', 'translate'].includes(questionType)) {
      return NextResponse.json({ error: '无效的题目类型' }, { status: 400 });
    }

    const question = await prisma.questionQueue.create({
      data: {
        userId: user.userId,
        questionType: questionType as QuestionType,
        status: 'GENERATING' as QuestionStatus,
        wordIds: wordIds as number[],
      },
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error('创建题目失败:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

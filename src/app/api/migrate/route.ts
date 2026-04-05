// API 路由：创建或更新用户（用于认证时自动创建用户）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const authCookie = request.cookies.get('gxwtf_auth');
    if (!authCookie) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userInfo = JSON.parse(authCookie.value);

    // 创建或更新用户
    const user = await prisma.user.upsert({
      where: { userId: userInfo.userId },
      update: {
        userName: userInfo.userName,
        admin: userInfo.admin || 0,
        email: userInfo.email,
        realName: userInfo.realName,
      },
      create: {
        userId: userInfo.userId,
        userName: userInfo.userName,
        admin: userInfo.admin || 0,
        email: userInfo.email,
        realName: userInfo.realName,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('创建用户失败:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

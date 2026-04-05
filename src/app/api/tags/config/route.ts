// API 路由：用户自定义标签配置
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function getUserFromCookie(request: NextRequest) {
  const authCookie = request.cookies.get('gxwtf_auth');
  if (!authCookie) return null;
  try {
    const userInfo = JSON.parse(authCookie.value);
    return { userId: userInfo.userId };
  } catch {
    return null;
  }
}

// GET - 获取用户的所有标签配置
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const tagConfigs = await prisma.tagConfig.findMany({
      where: { userId: user.userId },
    });

    // 转换为 Record 格式
    const result: Record<string, any> = {};
    for (const tag of tagConfigs) {
      result[tag.name] = {
        id: tag.name,
        name: tag.name,
        colorId: tag.colorId,
        description: tag.description || tag.name,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取标签配置失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST - 更新标签配置
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();

    // 删除旧配置
    await prisma.tagConfig.deleteMany({
      where: { userId: user.userId },
    });

    // 创建新配置
    if (body.tagConfigs && typeof body.tagConfigs === 'object') {
      const entries = Object.entries(body.tagConfigs);
      if (entries.length > 0) {
        await prisma.tagConfig.createMany({
          data: entries.map(([, config]: [string, any]) => ({
            userId: user.userId,
            name: config.name || config.id,
            colorId: config.colorId || 'blue',
            description: config.description,
          })),
        });
      }
    }

    const tagConfigs = await prisma.tagConfig.findMany({
      where: { userId: user.userId },
    });

    const result: Record<string, any> = {};
    for (const tag of tagConfigs) {
      result[tag.name] = {
        id: tag.name,
        name: tag.name,
        colorId: tag.colorId,
        description: tag.description || tag.name,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('更新标签配置失败:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

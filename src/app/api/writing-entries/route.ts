import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * API 认证机制
 *
 * 使用 Bearer API Key 认证：
 * - Authorization Header 必须为 "Bearer <API_KEY>"
 * - API_KEY 从环境变量 SECRET_API_KEY 读取
 * - 需要提供 userId 参数（URL query parameter）
 *
 * 安全说明：
 * - 生产环境：必须设置 SECRET_API_KEY 环境变量
 * - 只有持有正确 API_KEY 的服务才能访问此 API
 * - 防止滥用和隐私泄露
 */

// API Key 验证
function validateApiKey(request: NextRequest): boolean {
  const authorizationHeader = request.headers.get('Authorization');

  if (!authorizationHeader) {
    return false;
  }

  // 检查格式：Bearer <API_KEY>
  const parts = authorizationHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return false;
  }

  const providedApiKey = parts[1];
  const secretApiKey = process.env.SECRET_API_KEY;

  // 检查环境变量是否配置
  if (!secretApiKey) {
    console.error('SECRET_API_KEY 环境变量未配置');
    return false;
  }

  // 比较 API Key（使用严格比较，防止类型混淆）
  return providedApiKey === secretApiKey;
}

export async function GET(request: NextRequest) {
  try {
    // 验证 API Key
    if (!validateApiKey(request)) {
      return NextResponse.json(
        {
          success: false,
          error: '认证失败',
          message: '请提供正确的 API Key（Authorization: Bearer <API_KEY>）',
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    // 获取 userId 参数（必填）
    const url = new URL(request.url);
    const userIdParam = url.searchParams.get('userId');

    if (!userIdParam) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少参数',
          message: '请提供 userId 参数',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: '参数无效',
          message: 'userId 必须为有效的正整数',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // 验证用户是否存在
    const userExists = await prisma.user.findUnique({
      where: { userId }
    });

    if (!userExists) {
      return NextResponse.json(
        {
          success: false,
          error: '用户不存在',
          message: `用户 ID ${userId} 不存在`,
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
    }

    // 查询用户的作文积累内容
    const entries = await prisma.writingEntry.findMany({
      where: { userId },
      include: {
        tags: {
          include: { tag: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 格式化返回数据
    const formattedEntries = entries.map(entry => ({
      id: entry.id,
      content: entry.content,
      note: entry.note,
      tags: entry.tags.map(t => t.tag.name),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString()
    }));

    // 创建响应，并设置无缓存headers
    const response = NextResponse.json({
      success: true,
      userId,
      userName: userExists.userName,
      count: formattedEntries.length,
      entries: formattedEntries,
      timestamp: new Date().toISOString()
    });

    // 设置无缓存headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
  } catch (error) {
    // 详细记录错误
    console.error('查询作文积累失败:', error);
    console.error('错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息');

    // 返回错误信息（区分开发和生产环境）
    const isDev = process.env.NODE_ENV === 'development';
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
        details: isDev ? errorMessage : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
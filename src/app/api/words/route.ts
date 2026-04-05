// API 路由：单词的 CRUD 操作
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

// GET - 获取所有单词
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const words = await prisma.word.findMany({
      where: { userId: user.userId },
      include: {
        meanings: true,
        wordTags: { include: { tag: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 获取关联单词（按主单词文本分类）
    const relatedWords = await prisma.relatedWord.findMany({
      where: { userId: user.userId },
    });

    // 转换数据格式以匹配前端 Word 类型
    const formattedWords = words.map((word: any) => ({
      id: word.id,
      text: word.text,
      tags: word.wordTags.map((wt: any) => wt.tag.name),
      meanings: word.meanings.map((m: any) => ({
        content: m.content,
        type: m.type,
        sentence: m.sentence || '',
      })),
      relatedWords: relatedWords
        .filter((rw: any) => rw.wordText === word.text)
        .map((rw: any) => ({
          text: rw.relatedText,
          type: rw.type,
        })),
    }));

    return NextResponse.json(formattedWords);
  } catch (error) {
    console.error('获取单词列表失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST - 创建或更新单词
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { text, tags = [], meanings = [], relatedWords = [] } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: '单词不能为空' }, { status: 400 });
    }

    // 查找是否已存在相同单词
    const existing = await prisma.word.findFirst({
      where: { userId: user.userId, text: text.trim() },
      include: { wordTags: true },
    });

    if (existing) {
      // 更新现有单词
      const updatedWord = await prisma.word.update({
        where: { id: existing.id },
        data: {
          meanings: {
            deleteMany: {},
            create: meanings.map((m: any) => ({
              content: m.content,
              type: m.type,
              sentence: m.sentence || '',
            })),
          },
          wordTags: {
            deleteMany: {},
            create: tags.map((tag: string) => ({
              tag: {
                connectOrCreate: {
                  where: { name: tag },
                  create: { name: tag, colorId: 'blue' },
                },
              },
            })),
          },
        },
        include: {
          meanings: true,
          wordTags: { include: { tag: true } },
        },
      });

      // 更新关联单词
      await prisma.relatedWord.deleteMany({
        where: { userId: user.userId, wordText: text.trim() },
      });

      if (relatedWords.length > 0) {
        await prisma.relatedWord.createMany({
          data: relatedWords.map((rw: any) => ({
            userId: user.userId,
            wordText: text.trim(),
            relatedText: rw.text,
            type: rw.type,
          })),
        });
      }

      return NextResponse.json({
        id: updatedWord.id,
        text: updatedWord.text,
        tags: updatedWord.wordTags.map(wt => wt.tag.name),
        meanings: updatedWord.meanings.map(m => ({
          content: m.content,
          type: m.type,
          sentence: m.sentence || '',
        })),
        relatedWords,
      });
    } else {
      // 创建新单词
      const newWord = await prisma.word.create({
        data: {
          userId: user.userId,
          text: text.trim(),
          meanings: {
            create: meanings.map((m: any) => ({
              content: m.content,
              type: m.type,
              sentence: m.sentence || '',
            })),
          },
          wordTags: {
            create: tags.map((tag: string) => ({
              tag: {
                connectOrCreate: {
                  where: { name: tag },
                  create: { name: tag, colorId: 'blue' },
                },
              },
            })),
          },
        },
        include: {
          meanings: true,
          wordTags: { include: { tag: true } },
        },
      });

      // 创建关联单词
      if (relatedWords.length > 0) {
        await prisma.relatedWord.createMany({
          data: relatedWords.map((rw: any) => ({
            userId: user.userId,
            wordText: text.trim(),
            relatedText: rw.text,
            type: rw.type,
          })),
        });
      }

      return NextResponse.json({
        id: newWord.id,
        text: newWord.text,
        tags: newWord.wordTags.map(wt => wt.tag.name),
        meanings: newWord.meanings.map(m => ({
          content: m.content,
          type: m.type,
          sentence: m.sentence || '',
        })),
        relatedWords,
      });
    }
  } catch (error) {
    console.error('保存单词失败:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

// DELETE - 删除单词
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');

    if (!ids) {
      return NextResponse.json({ error: '缺少 ids 参数' }, { status: 400 });
    }

    const wordIds = ids.split(',').map(Number);

    await prisma.word.deleteMany({
      where: {
        id: { in: wordIds },
        userId: user.userId,
      },
    });

    // 同时删除关联单词记录
    const words = await prisma.word.findMany({
      where: { id: { in: wordIds } },
      select: { text: true },
    });

    for (const word of words) {
      await prisma.relatedWord.deleteMany({
        where: { userId: user.userId, wordText: word.text },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除单词失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}

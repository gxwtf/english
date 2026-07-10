'use server';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { prisma } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/iron';

export interface UserInfo {
  userId: number;
  userName: string;
  admin: number;
  email?: string;
  realName?: string;
}

async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function verifyAuth() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return { loggedIn: false };
    }

    // 自动创建或更新用户到数据库
    await prisma.user.upsert({
      where: { userId: session.userId },
      update: {
        userName: session.userName ?? '',
        admin: session.admin ?? 0,
        email: session.email,
        realName: session.realName,
      },
      create: {
        userId: session.userId,
        userName: session.userName ?? '',
        admin: session.admin ?? 0,
        email: session.email,
        realName: session.realName,
      },
    });

    return {
      loggedIn: true,
      userId: session.userId,
      userName: session.userName,
      admin: session.admin,
      email: session.email,
      realName: session.realName,
    };
  } catch {
    return { loggedIn: false };
  }
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  return { success: true };
}

export async function createUser() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return { success: false, error: '未登录' };
    }

    const created = await prisma.user.upsert({
      where: { userId: session.userId },
      update: {
        userName: session.userName ?? '',
        admin: session.admin ?? 0,
        email: session.email,
        realName: session.realName,
      },
      create: {
        userId: session.userId,
        userName: session.userName ?? '',
        admin: session.admin ?? 0,
        email: session.email,
        realName: session.realName,
      },
    });

    return { success: true, user: created };
  } catch (error) {
    console.error('创建用户失败:', error);
    return { success: false, error: '创建失败' };
  }
}

export async function getAuthUser(): Promise<UserInfo | null> {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return null;
    }

    return {
      userId: session.userId,
      userName: session.userName ?? '',
      admin: session.admin ?? 0,
      email: session.email,
      realName: session.realName,
    };
  } catch {
    return null;
  }
}

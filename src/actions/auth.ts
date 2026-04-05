'use server';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

export interface UserInfo {
  userId: number;
  userName: string;
  admin: number;
  email?: string;
  realName?: string;
}

async function getUserFromCookie(): Promise<UserInfo> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('gxwtf_auth');
  if (!authCookie) throw new Error('未登录');
  try {
    const userInfo = JSON.parse(authCookie.value);
    return { userId: userInfo.userId, userName: userInfo.userName, admin: userInfo.admin, email: userInfo.email, realName: userInfo.realName };
  } catch {
    throw new Error('未登录');
  }
}

export async function verifyAuth() {
  try {
    const user = await getUserFromCookie();

    // 自动创建或更新用户到数据库
    await prisma.user.upsert({
      where: { userId: user.userId },
      update: {
        userName: user.userName,
        admin: user.admin,
        email: user.email,
        realName: user.realName,
      },
      create: {
        userId: user.userId,
        userName: user.userName,
        admin: user.admin,
        email: user.email,
        realName: user.realName,
      },
    });

    return {
      loggedIn: true,
      userId: user.userId,
      userName: user.userName,
      admin: user.admin,
      email: user.email,
      realName: user.realName,
    };
  } catch {
    return { loggedIn: false };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.set('gxwtf_auth', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return { success: true };
}

export async function createUser() {
  try {
    const user = await getUserFromCookie();

    const created = await prisma.user.upsert({
      where: { userId: user.userId },
      update: {
        userName: user.userName,
        admin: user.admin || 0,
        email: user.email,
        realName: user.realName,
      },
      create: {
        userId: user.userId,
        userName: user.userName,
        admin: user.admin || 0,
        email: user.email,
        realName: user.realName,
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
    return getUserFromCookie();
  } catch {
    return null;
  }
}

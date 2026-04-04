// 验证用户登录状态
import { NextRequest, NextResponse } from "next/server";

// 验证本地 cookie 中的用户信息
export async function GET(request: NextRequest) {
  try {
    const authCookie = request.cookies.get("gxwtf_auth");

    if (!authCookie) {
      return NextResponse.json({ loggedIn: false }, { status: 401 });
    }

    try {
      const userInfo = JSON.parse(authCookie.value);
      return NextResponse.json({
        loggedIn: true,
        userId: userInfo.userId,
        userName: userInfo.userName,
        admin: userInfo.admin,
        email: userInfo.email,
        realName: userInfo.realName,
      });
    } catch (e) {
      // Cookie 解析失败
      return NextResponse.json({ loggedIn: false }, { status: 401 });
    }
  } catch (e) {
    console.error("Auth verify error:", e);
    return NextResponse.json({ loggedIn: false, error: "验证失败" }, { status: 500 });
  }
}

// 登出
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set("gxwtf_auth", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

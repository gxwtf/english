// 广学账号 SSO Callback - 验证 token 并返回用户信息
// 此路由位于 /sso/callback，对应广学账号后端的回调路径
import { NextRequest, NextResponse } from "next/server";

const GXACCOUNT_URL = process.env.GXACCOUNT_URL || "https://account.gxwtf.cn";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new NextResponse("缺少 Token", { status: 400 });
  }

  try {
    // 向广学账号验证 token
    const response = await fetch(`${GXACCOUNT_URL}/sso/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token }),
    });

    if (!response.ok) {
      console.error("Token 验证失败，状态码:", response.status);
      return new NextResponse("Token 验证失败", { status: 403 });
    }

    const data = await response.json();

    if (!data.success) {
      console.error("验证失败:", data.error);
      return new NextResponse("验证失败", { status: 403 });
    }

    // 验证成功，重定向到 back 参数指定的页面
    // 首先创建响应以设置 cookie
    const redirectUrl = new URL("/", url.origin);
    const response_with_cookie = NextResponse.redirect(redirectUrl);

    // 设置 cookie 存储用户信息
    const userInfo = {
      userId: data.userId,
      userName: data.userName,
      admin: data.admin,
      email: data.userEmail,
      realName: data.userRealName,
    };

    response_with_cookie.cookies.set("gxwtf_auth", JSON.stringify(userInfo), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: "/",
    });

    return response_with_cookie;
  } catch (e) {
    console.error("SSO Callback Error:", e);
    return new NextResponse("验证服务不可用", { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/iron";

const GXACCOUNT_URL = process.env.GXACCOUNT_URL || "https://account.gxwtf.cn";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const host = request.headers.get("host");
  const back = url.searchParams.get("back") || "/";

  // 初始化 iron-session
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!token) {
    return NextResponse.redirect(new URL("/", "http://" + host), 302);
  }

  try {
    const response = await fetch(`${GXACCOUNT_URL}/sso/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      console.error("Token 验证失败，状态码:", response.status);
      return NextResponse.redirect(new URL("/", "http://" + host), 302);
    }

    const data = await response.json();

    if (!data.success) {
      console.error("验证失败:", data.error);
      return NextResponse.redirect(new URL("/", "http://" + host), 302);
    }

    // SSO 验证通过，将用户信息加密写入 iron-session
    session.isLoggedIn = true;
    session.userId = data.userId;
    session.userName = data.userName;
    session.admin = data.admin;
    session.email = data.userEmail;
    session.realName = data.userRealName;

    // 关键操作：加密保存！iron-session 会将数据加密后通过 Set-Cookie 发给浏览器
    await session.save();

    return NextResponse.redirect(new URL(back, "http://" + host), 302);
  } catch (e) {
    console.error("SSO Callback Error:", e);
    return NextResponse.redirect(new URL("/", "http://" + host), 302);
  }
}

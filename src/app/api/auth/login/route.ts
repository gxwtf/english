// 重定向到广学账号登录页
import { NextRequest, NextResponse } from "next/server";

const GXACCOUNT_URL = process.env.GXACCOUNT_URL || "https://account.gxwtf.cn";

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  // back 参数是登录后最终跳转的页面
  const back = searchParams.get("back") || "/";
  const host = request.headers.get("host");
  const system = host || "localhost:3000";

  // 构建广学账号登录 URL
  // 根据广学账号 API 文档，back 参数应该是 /sso/callback?back=/
  const callbackUrl = `/sso/callback?back=${encodeURIComponent(back)}`;
  const loginUrl = `${GXACCOUNT_URL}/sso/login?system=${encodeURIComponent(
    system
  )}&back=${encodeURIComponent(callbackUrl)}`;

  return NextResponse.redirect(loginUrl);
}

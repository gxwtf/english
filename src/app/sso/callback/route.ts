import { NextRequest, NextResponse } from "next/server";

const GXACCOUNT_URL = process.env.GXACCOUNT_URL || "https://account.gxwtf.cn";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const host = request.headers.get('host');
  const back = url.searchParams.get("back") || "/";

  if (!token) {
    return NextResponse.redirect(new URL("/", "http://"+host), 302);
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
      return NextResponse.redirect(new URL("/", "http://"+host), 302);
    }

    const data = await response.json();

    if (!data.success) {
      console.error("验证失败:", data.error);
      return NextResponse.redirect(new URL("/", "http://"+host), 302);
    }

    const userInfo = {
      userId: data.userId,
      userName: data.userName,
      admin: data.admin,
      email: data.userEmail,
      realName: data.userRealName,
    };

    const response_with_cookie = NextResponse.redirect(new URL(back, "http://"+host), 302);
    response_with_cookie.cookies.set("gxwtf_auth", JSON.stringify(userInfo), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response_with_cookie;
  } catch (e) {
    console.error("SSO Callback Error:", e);
    return NextResponse.redirect(new URL("/", "http://"+host), 302);
  }
}

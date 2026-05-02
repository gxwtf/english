import { NextRequest, NextResponse } from "next/server";

const GXACCOUNT_URL = process.env.GXACCOUNT_URL || "https://account.gxwtf.cn";

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const back = url.searchParams.get("back") || "/";
  const host = request.headers.get("host");
  const system = host || "localhost:3000";

  const loginUrl = `${GXACCOUNT_URL}/sso/login?system=${encodeURIComponent(
    system
  )}&back=${encodeURIComponent(back)}`;

  return NextResponse.redirect(loginUrl);
}

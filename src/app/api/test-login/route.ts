import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/iron";

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.isLoggedIn = true;
  session.userId = 2443;
  session.userName = "test";
  session.admin = 1;
  await session.save();
  return NextResponse.redirect("http://localhost:3003/");
}

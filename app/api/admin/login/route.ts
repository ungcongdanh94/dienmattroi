import { NextResponse } from "next/server";
import { checkPassword, signSessionToken, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const password = body?.password as string | undefined;

  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: "Sai mật khẩu" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, signSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 ngày
    path: "/",
  });
  return res;
}

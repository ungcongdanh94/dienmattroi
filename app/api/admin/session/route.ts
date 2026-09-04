import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function GET() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  return NextResponse.json({ authenticated: verifySessionToken(token) });
}

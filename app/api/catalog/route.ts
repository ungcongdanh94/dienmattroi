import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCatalog, saveCatalog } from "@/lib/catalog-store";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function GET() {
  return NextResponse.json(getCatalog());
}

export async function PUT(req: Request) {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.panels) || !Array.isArray(body.inverters) || !Array.isArray(body.batteries)) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  saveCatalog(body);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProjects, saveProjects, type ProjectEntry } from "@/lib/projects-store";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function GET() {
  return NextResponse.json(getProjects());
}

export async function PUT(req: Request) {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  saveProjects(body as ProjectEntry[]);
  return NextResponse.json({ ok: true });
}

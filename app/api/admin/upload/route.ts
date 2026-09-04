import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";
import { UPLOADS_DIR, ensureUploadsDir } from "@/lib/projects-store";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Không có file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File quá lớn (tối đa 8MB)" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  ensureUploadsDir();
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), bytes);

  return NextResponse.json({ url: `/api/uploads/${filename}` });
}

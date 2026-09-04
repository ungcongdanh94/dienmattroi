import crypto from "crypto";

/**
 * ⚠️ Cần đặt biến môi trường ADMIN_PASSWORD trên Railway (Settings → Variables)
 * để đăng nhập trang /admin. Nếu chưa đặt, mật khẩu mặc định là "congthanh2026"
 * — nên đổi ngay sau khi deploy.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "congthanh2026";
const SECRET = process.env.ADMIN_SECRET || ADMIN_PASSWORD;

export function checkPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export function signSessionToken(): string {
  const payload = "admin";
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

export const ADMIN_COOKIE_NAME = "admin_session";

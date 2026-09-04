import { NextResponse } from "next/server";
import { EVN_TARIFF_2026 } from "@/lib/evn-tariff";

/**
 * GET /api/tariff
 * Trả về bảng giá điện EVN hiện hành đang cấu hình trong hệ thống.
 * Sửa lib/evn-tariff.ts khi có giá mới, không cần sửa UI.
 */
export async function GET() {
  return NextResponse.json(EVN_TARIFF_2026);
}

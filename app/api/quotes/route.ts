import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getQuotes, appendQuote, type QuoteRecord } from "@/lib/quotes-store";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function GET() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getQuotes());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.quoteCode !== "string") {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const record: QuoteRecord = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    quoteCode: body.quoteCode,
    customerName: body.customerName || "",
    customerPhone: body.customerPhone || "",
    siteAddress: body.siteAddress || "",
    systemType: body.systemType || "",
    pvSizeKwp: Number(body.pvSizeKwp) || 0,
    panelBrand: body.panelBrand || "",
    inverterBrand: body.inverterBrand || "",
    batteryBrand: body.batteryBrand || null,
    totalPaymentVnd: Number(body.totalPaymentVnd) || 0,
    exportKind: body.exportKind === "pdf" ? "pdf" : "png",
  };

  appendQuote(record);
  return NextResponse.json({ ok: true });
}

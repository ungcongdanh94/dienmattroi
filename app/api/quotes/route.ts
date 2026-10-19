import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getQuotes, appendQuote, getQuoteSnapshot, type QuoteRecord, type QuoteListItem } from "@/lib/quotes-store";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const snapshot = getQuoteSnapshot(id);
    if (!snapshot) return NextResponse.json({ error: "Báo giá này không có dữ liệu lưu để mở lại" }, { status: 404 });
    return NextResponse.json(snapshot);
  }
  const list: QuoteListItem[] = getQuotes().map(({ snapshot, ...rest }) => ({ ...rest, hasSnapshot: !!snapshot }));
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.quoteCode !== "string") {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  // Chỉ nhận snapshot nếu đúng dạng và không quá lớn (tránh phình file lưu trữ)
  const snap = body.snapshot;
  const snapshot =
    snap && typeof snap === "object" && Array.isArray(snap.items) && JSON.stringify(snap).length < 100_000 ? snap : undefined;

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
    exportKind: body.exportKind === "pdf" ? "pdf" : body.exportKind === "xlsx" ? "xlsx" : "png",
    ...(snapshot ? { snapshot } : {}),
  };

  appendQuote(record);
  return NextResponse.json({ ok: true });
}

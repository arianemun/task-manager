import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  if (!publicKey) {
    return NextResponse.json({ error: "کلید VAPID تنظیم نشده" }, { status: 503 });
  }
  return NextResponse.json({ publicKey });
}

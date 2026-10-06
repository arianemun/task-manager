import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/auth";
import {
  closeMissedPeriods,
  generateOccurrences,
} from "@/server/services/occurrence-generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authorizeCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const generated = generateOccurrences();
  // پس از catch-up، دوره‌های گذشتهٔ بی‌پاسخ را ببند
  const closed = closeMissedPeriods();

  return NextResponse.json({
    ok: true,
    generated,
    closed,
  });
}

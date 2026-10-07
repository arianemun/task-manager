import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { checkRealtimeProcess } from "@/lib/health/processes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus: "up" | "down" = "up";
  try {
    db.select({ v: sql<number>`1` }).from(settings).limit(1).all();
  } catch {
    dbStatus = "down";
  }

  const realtime = await checkRealtimeProcess();
  const ok = dbStatus === "up" && realtime === "up";
  return NextResponse.json(
    {
      ok,
      db: dbStatus,
      next: "up",
      realtime,
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}

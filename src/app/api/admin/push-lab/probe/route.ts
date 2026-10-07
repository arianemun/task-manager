import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/user";
import { probePushServices } from "@/lib/push/probe";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser({ roles: ["ADMIN"] });
    const proxy = process.env.PUSH_PROXY_URL?.trim() || "";
    const results = await probePushServices(proxy || undefined);
    return NextResponse.json({
      proxyConfigured: Boolean(proxy),
      results,
    });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}

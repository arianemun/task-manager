import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskOccurrences } from "@/db/schema";
import { authErrorResponse } from "@/lib/auth/http";
import { requireUser, type AuthUser } from "@/lib/auth/user";
import {
  departmentIdsForUser,
  sharesDepartment,
} from "@/lib/departments/membership";
import { parseAttachmentPath } from "@/lib/uploads/attachment";
import { resolveUploadPath } from "@/lib/uploads/avatar";

type Params = { params: Promise<{ path: string[] }> };

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

function canAccessFile(actor: AuthUser, relative: string): boolean {
  if (relative.startsWith("avatars/")) {
    const parts = relative.split("/");
    const ownerId = Number(parts[1]);
    if (!Number.isInteger(ownerId)) return false;
    if (actor.role === "ADMIN") return true;
    if (actor.id === ownerId) return true;
    if (actor.role === "MANAGER" && actor.departmentIds.length > 0) {
      return sharesDepartment(actor.departmentIds, departmentIdsForUser(ownerId));
    }
    return false;
  }

  if (relative.startsWith("attachments/")) {
    const parsed = parseAttachmentPath(relative);
    if (!parsed) return false;
    const occ = db
      .select()
      .from(taskOccurrences)
      .where(eq(taskOccurrences.id, parsed.occurrenceId))
      .get();
    if (!occ || occ.userId !== parsed.userId) return false;
    if (actor.id === occ.userId) return true;
    if (actor.role === "ADMIN") return true;
    if (actor.role === "MANAGER" && actor.departmentIds.length > 0) {
      return sharesDepartment(
        actor.departmentIds,
        departmentIdsForUser(occ.userId),
      );
    }
    return false;
  }

  return actor.role === "ADMIN";
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const actor = await requireUser({ allowMustChangePassword: true });
    const segments = (await params).path;
    const relative = segments.join("/");
    if (!relative || relative.includes("..")) {
      return NextResponse.json({ error: "مسیر نامعتبر" }, { status: 400 });
    }

    if (!canAccessFile(actor, relative)) {
      return NextResponse.json({ error: "دسترسی ندارید" }, { status: 403 });
    }

    const abs = resolveUploadPath(relative);
    const uploadRoot = path.resolve(
      process.env.UPLOAD_DIR?.startsWith("/") ||
        /^[A-Za-z]:/.test(process.env.UPLOAD_DIR ?? "")
        ? (process.env.UPLOAD_DIR as string)
        : path.join(process.cwd(), process.env.UPLOAD_DIR ?? "uploads"),
    );
    if (!abs.startsWith(uploadRoot)) {
      return NextResponse.json({ error: "مسیر نامعتبر" }, { status: 400 });
    }

    const data = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    return NextResponse.json({ error: "فایل یافت نشد" }, { status: 404 });
  }
}

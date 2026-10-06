"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  announcementReads,
  announcementTargets,
  announcements,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { isAuthError } from "@/lib/auth/errors";
import { requirePermission, requireUser } from "@/lib/auth/user";
import type { ActionResult } from "./auth";

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  audience: z.enum(["ALL", "DEPARTMENT", "USERS"]),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  isPinned: z.coerce.boolean().optional(),
  userIds: z.array(z.coerce.number().int().positive()).optional(),
});

export async function createAnnouncementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("announcements.manage");
    const userIds = formData.getAll("userIds").map(Number).filter(Number.isInteger);

    const parsed = announcementSchema.safeParse({
      title: formData.get("title"),
      body: formData.get("body"),
      audience: formData.get("audience") || "ALL",
      departmentId: formData.get("departmentId") || null,
      isPinned: formData.get("isPinned") === "on" || formData.get("isPinned") === "true",
      userIds,
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }

    const data = parsed.data;
    if (actor.role === "MANAGER") {
      if (!actor.departmentId) {
        return { ok: false, error: "دپارتمان سرپرست مشخص نیست" };
      }
      data.audience = "DEPARTMENT";
      data.departmentId = actor.departmentId;
    }

    if (data.audience === "DEPARTMENT" && !data.departmentId) {
      return { ok: false, error: "دپارتمان را انتخاب کنید" };
    }
    if (data.audience === "USERS" && (!data.userIds || data.userIds.length === 0)) {
      return { ok: false, error: "حداقل یک کاربر انتخاب کنید" };
    }

    const row = db
      .insert(announcements)
      .values({
        title: data.title,
        body: data.body,
        audience: data.audience,
        departmentId: data.departmentId ?? null,
        isPinned: Boolean(data.isPinned),
        authorId: actor.id,
        startsAt: new Date(),
      })
      .returning({ id: announcements.id })
      .get();

    if (data.audience === "USERS" && data.userIds) {
      for (const userId of data.userIds) {
        db.insert(announcementTargets)
          .values({ announcementId: row.id, userId })
          .run();
      }
    }

    writeAuditLog({
      actorId: actor.id,
      action: "announcement.create",
      entity: "announcement",
      entityId: row.id,
      meta: { audience: data.audience, isPinned: data.isPinned },
    });

    revalidatePath("/admin/announcements");
    revalidatePath("/me/info");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deleteAnnouncementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("announcements.manage");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) {
      return { ok: false, error: "شناسه نامعتبر است" };
    }

    const ann = db
      .select()
      .from(announcements)
      .where(eq(announcements.id, id))
      .get();
    if (!ann) return { ok: false, error: "اطلاعیه یافت نشد" };

    if (
      actor.role === "MANAGER" &&
      ann.departmentId !== actor.departmentId
    ) {
      return { ok: false, error: "دسترسی به این اطلاعیه ندارید" };
    }

    db.delete(announcements).where(eq(announcements.id, id)).run();
    writeAuditLog({
      actorId: actor.id,
      action: "announcement.delete",
      entity: "announcement",
      entityId: id,
    });

    revalidatePath("/admin/announcements");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function markAnnouncementReadAction(
  announcementId: number,
): Promise<ActionResult> {
  try {
    const actor = await requireUser();
    const existing = db
      .select()
      .from(announcementReads)
      .where(
        and(
          eq(announcementReads.announcementId, announcementId),
          eq(announcementReads.userId, actor.id),
        ),
      )
      .get();

    if (!existing) {
      db.insert(announcementReads)
        .values({
          announcementId,
          userId: actor.id,
          readAt: new Date(),
        })
        .run();
    }

    revalidatePath("/me/info");
    revalidatePath("/me");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}


export async function getAnnouncementReadStats(announcementId: number): Promise<{
  read: number;
  unread: number;
}> {
  const actor = await requirePermission("announcements.manage");
  const ann = db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .get();
  if (!ann) return { read: 0, unread: 0 };

  let audienceUserIds: number[] = [];
  if (ann.audience === "ALL") {
    audienceUserIds = db
      .select({ id: users.id })
      .from(users)
      .all()
      .map((u) => u.id);
  } else if (ann.audience === "DEPARTMENT" && ann.departmentId) {
    audienceUserIds = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.departmentId, ann.departmentId))
      .all()
      .map((u) => u.id);
  } else {
    audienceUserIds = db
      .select({ userId: announcementTargets.userId })
      .from(announcementTargets)
      .where(eq(announcementTargets.announcementId, announcementId))
      .all()
      .map((t) => t.userId);
  }

  if (actor.role === "MANAGER" && actor.departmentId) {
    const deptIds = new Set(
      db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.departmentId, actor.departmentId))
        .all()
        .map((u) => u.id),
    );
    audienceUserIds = audienceUserIds.filter((id) => deptIds.has(id));
  }

  if (audienceUserIds.length === 0) return { read: 0, unread: 0 };

  const reads = db
    .select()
    .from(announcementReads)
    .where(
      and(
        eq(announcementReads.announcementId, announcementId),
        inArray(announcementReads.userId, audienceUserIds),
      ),
    )
    .all();

  return {
    read: reads.length,
    unread: Math.max(0, audienceUserIds.length - reads.length),
  };
}

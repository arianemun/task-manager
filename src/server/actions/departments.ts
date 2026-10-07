"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { departments, userDepartments, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { currentMembershipSql } from "@/lib/departments/membership";
import { isAuthError } from "@/lib/auth/errors";
import { requirePermission, requireUser } from "@/lib/auth/user";
import { normalizePersianText } from "@/lib/validation/normalize";
import type { ActionResult } from "./auth";

const deptSchema = z.object({
  name: z.string().trim().min(2, "نام دپارتمان الزامی است").max(100),
  managerId: z.coerce.number().int().positive().nullable().optional(),
});

export async function createDepartmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("staff.manage");
    if (actor.role === "MANAGER") {
      return { ok: false, error: "سرپرست نمی‌تواند دپارتمان جدید بسازد" };
    }

    const parsed = deptSchema.safeParse({
      name: formData.get("name"),
      managerId: formData.get("managerId") || null,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }

    const row = db
      .insert(departments)
      .values({
        name: parsed.data.name.trim(),
        managerId: parsed.data.managerId ?? null,
      })
      .returning({ id: departments.id })
      .get();

    writeAuditLog({
      actorId: actor.id,
      action: "department.create",
      entity: "department",
      entityId: row.id,
      meta: { name: parsed.data.name },
    });

    revalidatePath("/admin/departments");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateDepartmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("staff.manage");
    if (actor.role === "MANAGER") {
      return { ok: false, error: "سرپرست نمی‌تواند دپارتمان را ویرایش کند" };
    }

    const id = Number(formData.get("id"));
    const parsed = deptSchema.safeParse({
      name: formData.get("name"),
      managerId: formData.get("managerId") || null,
    });
    if (!Number.isInteger(id) || !parsed.success) {
      return { ok: false, error: "ورودی نامعتبر است" };
    }

    db.update(departments)
      .set({
        name: parsed.data.name.trim(),
        managerId: parsed.data.managerId ?? null,
      })
      .where(eq(departments.id, id))
      .run();

    writeAuditLog({
      actorId: actor.id,
      action: "department.update",
      entity: "department",
      entityId: id,
      meta: { name: parsed.data.name },
    });

    revalidatePath("/admin/departments");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deleteDepartmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireUser({ roles: ["ADMIN"] });
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) {
      return { ok: false, error: "شناسه نامعتبر است" };
    }

    const linked = db
      .select({ c: count() })
      .from(userDepartments)
      .innerJoin(users, eq(users.id, userDepartments.userId))
      .where(
        and(
          eq(userDepartments.departmentId, id),
          currentMembershipSql(),
          isNull(users.deletedAt),
        ),
      )
      .get();
    const legacy = db
      .select({ c: count() })
      .from(users)
      .where(and(eq(users.departmentId, id), isNull(users.deletedAt)))
      .get();
    const members = { c: Math.max(linked?.c ?? 0, legacy?.c ?? 0) };

    if ((members?.c ?? 0) > 0) {
      return {
        ok: false,
        error: "حذف دپارتمانی که عضو دارد مجاز نیست",
      };
    }

    const dept = db.select().from(departments).where(eq(departments.id, id)).get();
    db.delete(departments).where(eq(departments.id, id)).run();

    writeAuditLog({
      actorId: actor.id,
      action: "department.delete",
      entity: "department",
      entityId: id,
      meta: { name: dept?.name, searchHint: normalizePersianText(dept?.name ?? "") },
    });

    revalidatePath("/admin/departments");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

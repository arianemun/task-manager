"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  departments,
  notDoneReasonDepartments,
  notDoneReasons,
  taskOccurrences,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { isAuthError } from "@/lib/auth/errors";
import { requirePermission } from "@/lib/auth/user";
import { ensureNotDoneReasonsSeeded } from "@/lib/settings/not-done-reasons";
import type { ActionResult } from "./auth";

const reasonSchema = z.object({
  label: z.string().trim().min(2, "عنوان دلیل حداقل ۲ حرف باشد").max(80),
  departmentIds: z.array(z.number().int().positive()),
});

function parseDepartmentIds(raw: FormDataEntryValue | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  } catch {
    return [];
  }
}

function assertDepartmentsExist(ids: number[]): string | null {
  if (ids.length === 0) return null;
  const rows = db
    .select({ id: departments.id })
    .from(departments)
    .all()
    .map((row) => row.id);
  const known = new Set(rows);
  if (ids.some((id) => !known.has(id))) return "دپارتمان نامعتبر است";
  return null;
}

function revalidateReasonViews() {
  revalidatePath("/admin/reasons");
  revalidatePath("/admin/settings");
  revalidatePath("/me");
  revalidatePath("/admin/reports");
}

function newCode(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function createReasonAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("tasks.create");
    ensureNotDoneReasonsSeeded();
    const parsed = reasonSchema.safeParse({
      label: formData.get("label"),
      departmentIds: parseDepartmentIds(formData.get("departmentIds")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }
    const deptError = assertDepartmentsExist(parsed.data.departmentIds);
    if (deptError) return { ok: false, error: deptError };

    const duplicate = db
      .select({ id: notDoneReasons.id })
      .from(notDoneReasons)
      .where(eq(notDoneReasons.label, parsed.data.label))
      .get();
    if (duplicate) return { ok: false, error: "دلیلی با این عنوان وجود دارد" };

    const row = db
      .insert(notDoneReasons)
      .values({ code: newCode(), label: parsed.data.label })
      .returning({ id: notDoneReasons.id })
      .get();

    if (parsed.data.departmentIds.length > 0) {
      db.insert(notDoneReasonDepartments)
        .values(
          parsed.data.departmentIds.map((departmentId) => ({
            reasonId: row.id,
            departmentId,
          })),
        )
        .run();
    }

    writeAuditLog({
      actorId: actor.id,
      action: "reason.create",
      entity: "not_done_reason",
      entityId: row.id,
      meta: {
        label: parsed.data.label,
        departmentIds: parsed.data.departmentIds,
      },
    });
    revalidateReasonViews();
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateReasonAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("tasks.create");
    ensureNotDoneReasonsSeeded();
    const id = Number(formData.get("id"));
    const parsed = reasonSchema.safeParse({
      label: formData.get("label"),
      departmentIds: parseDepartmentIds(formData.get("departmentIds")),
    });
    if (!Number.isInteger(id) || id <= 0 || !parsed.success) {
      return {
        ok: false,
        error: parsed.success
          ? "شناسه نامعتبر است"
          : (parsed.error.issues[0]?.message ?? "نامعتبر"),
      };
    }
    const deptError = assertDepartmentsExist(parsed.data.departmentIds);
    if (deptError) return { ok: false, error: deptError };

    const current = db
      .select()
      .from(notDoneReasons)
      .where(eq(notDoneReasons.id, id))
      .get();
    if (!current) return { ok: false, error: "دلیل پیدا نشد" };

    const duplicate = db
      .select({ id: notDoneReasons.id })
      .from(notDoneReasons)
      .where(eq(notDoneReasons.label, parsed.data.label))
      .get();
    if (duplicate && duplicate.id !== id) {
      return { ok: false, error: "دلیلی با این عنوان وجود دارد" };
    }

    db.transaction((tx) => {
      tx.update(notDoneReasons)
        .set({ label: parsed.data.label })
        .where(eq(notDoneReasons.id, id))
        .run();
      tx.delete(notDoneReasonDepartments)
        .where(eq(notDoneReasonDepartments.reasonId, id))
        .run();
      if (parsed.data.departmentIds.length > 0) {
        tx.insert(notDoneReasonDepartments)
          .values(
            parsed.data.departmentIds.map((departmentId) => ({
              reasonId: id,
              departmentId,
            })),
          )
          .run();
      }
    });

    writeAuditLog({
      actorId: actor.id,
      action: "reason.update",
      entity: "not_done_reason",
      entityId: id,
      meta: {
        label: parsed.data.label,
        departmentIds: parsed.data.departmentIds,
      },
    });
    revalidateReasonViews();
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deleteReasonAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("tasks.create");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, error: "شناسه نامعتبر است" };
    }
    const row = db
      .select()
      .from(notDoneReasons)
      .where(eq(notDoneReasons.id, id))
      .get();
    if (!row) return { ok: false, error: "دلیل پیدا نشد" };

    const used =
      db
        .select({ c: count() })
        .from(taskOccurrences)
        .where(eq(taskOccurrences.reasonCode, row.code))
        .get()?.c ?? 0;
    if (used > 0) {
      return {
        ok: false,
        error: "این دلیل در پاسخ‌ها استفاده شده و قابل حذف نیست",
      };
    }

    db.delete(notDoneReasons).where(eq(notDoneReasons.id, id)).run();
    writeAuditLog({
      actorId: actor.id,
      action: "reason.delete",
      entity: "not_done_reason",
      entityId: id,
      meta: { label: row.label },
    });
    revalidateReasonViews();
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

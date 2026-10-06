"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { taskCategories, taskTemplates } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { isAuthError } from "@/lib/auth/errors";
import { requirePermission } from "@/lib/auth/user";
import type { ActionResult } from "./auth";

const categorySchema = z.object({
  name: z.string().trim().min(2, "نام دسته حداقل ۲ حرف باشد").max(80),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "رنگ باید به صورت #RRGGBB باشد"),
});

function revalidateCategoryViews() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/tasks", "layout");
  revalidatePath("/admin/reports");
}

export async function createCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("tasks.create");
    const parsed = categorySchema.safeParse({
      name: formData.get("name"),
      color: formData.get("color") || "#64748b",
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }

    const duplicate = db
      .select({ id: taskCategories.id })
      .from(taskCategories)
      .where(eq(taskCategories.name, parsed.data.name))
      .get();
    if (duplicate) {
      return { ok: false, error: "دسته‌ای با این نام وجود دارد" };
    }

    const row = db
      .insert(taskCategories)
      .values({ name: parsed.data.name, color: parsed.data.color })
      .returning({ id: taskCategories.id })
      .get();

    writeAuditLog({
      actorId: actor.id,
      action: "category.create",
      entity: "task_category",
      entityId: row.id,
      meta: { name: parsed.data.name, color: parsed.data.color },
    });
    revalidateCategoryViews();
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("tasks.create");
    const id = Number(formData.get("id"));
    const parsed = categorySchema.safeParse({
      name: formData.get("name"),
      color: formData.get("color"),
    });
    if (!Number.isInteger(id) || id <= 0 || !parsed.success) {
      return {
        ok: false,
        error: parsed.success
          ? "شناسه نامعتبر است"
          : (parsed.error.issues[0]?.message ?? "نامعتبر"),
      };
    }

    const current = db
      .select({ id: taskCategories.id })
      .from(taskCategories)
      .where(eq(taskCategories.id, id))
      .get();
    if (!current) return { ok: false, error: "دسته پیدا نشد" };

    const duplicate = db
      .select({ id: taskCategories.id })
      .from(taskCategories)
      .where(eq(taskCategories.name, parsed.data.name))
      .get();
    if (duplicate && duplicate.id !== id) {
      return { ok: false, error: "دسته‌ای با این نام وجود دارد" };
    }

    db.update(taskCategories)
      .set({ name: parsed.data.name, color: parsed.data.color })
      .where(eq(taskCategories.id, id))
      .run();

    writeAuditLog({
      actorId: actor.id,
      action: "category.update",
      entity: "task_category",
      entityId: id,
      meta: { name: parsed.data.name, color: parsed.data.color },
    });
    revalidateCategoryViews();
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deleteCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("tasks.create");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, error: "شناسه نامعتبر است" };
    }

    const used =
      db
        .select({ c: count() })
        .from(taskTemplates)
        .where(eq(taskTemplates.categoryId, id))
        .get()?.c ?? 0;
    if (used > 0) {
      return {
        ok: false,
        error: "این دسته در کارها استفاده شده و قابل حذف نیست",
      };
    }

    const row = db
      .select()
      .from(taskCategories)
      .where(eq(taskCategories.id, id))
      .get();
    db.delete(taskCategories).where(eq(taskCategories.id, id)).run();

    writeAuditLog({
      actorId: actor.id,
      action: "category.delete",
      entity: "task_category",
      entityId: id,
      meta: { name: row?.name },
    });
    revalidateCategoryViews();
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

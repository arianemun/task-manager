"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  PERMISSIONS,
  departments,
  taskAssignments,
  userPermissions,
  users,
  type Permission,
  type Role,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { isAuthError } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import {
  bumpSessionVersion,
  requirePermission,
  requireUser,
} from "@/lib/auth/user";
import { todayTehran } from "@/lib/dates";
import { generateTempPassword } from "@/lib/password-gen";
import {
  assertCanAssignRole,
  assertCanDeactivate,
  assertCanModifyPermissions,
  assertUserInScope,
} from "@/lib/scope/users";
import { saveAvatarFile } from "@/lib/uploads/avatar";
import {
  fullNameSchema,
  iranMobileSchema,
  nationalCodeSchema,
  usernameSchema,
} from "@/lib/validation/iran";
import { normalizePersianText } from "@/lib/validation/normalize";
import {
  departmentIdsForUser,
  setUserDepartments,
  userIdsInDepartments,
} from "@/lib/departments/membership";
import {
  generateOccurrences,
  removeDeptOnlyPendingOnTransfer,
} from "@/server/services/occurrence-generate";
import type { ActionResult } from "./auth";

const createStaffSchema = z.object({
  username: usernameSchema,
  fullName: fullNameSchema,
  nationalCode: nationalCodeSchema.optional().or(z.literal("")),
  phone: iranMobileSchema.optional().or(z.literal("")),
  email: z.string().trim().email("ایمیل معتبر نیست").optional().or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  role: z.enum(["ADMIN", "MANAGER", "STAFF"]),
  hireDate: z.string().trim().optional().or(z.literal("")),
});

function parseDepartmentIds(value: FormDataEntryValue | null): number[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return [
        ...new Set(
          parsed
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0),
        ),
      ];
    }
  } catch {
    /* مقدار تکی */
  }
  const single = Number(raw);
  return Number.isInteger(single) && single > 0 ? [single] : [];
}

function unknownDepartmentError(ids: number[]): string | null {
  if (ids.length === 0) return null;
  const found = db
    .select({ id: departments.id })
    .from(departments)
    .where(inArray(departments.id, ids))
    .all();
  if (found.length !== ids.length) return "دپارتمان نامعتبر است";
  return null;
}

function generateDepartmentTasks(userId: number, departmentIds: number[]) {
  const today = todayTehran();
  for (const departmentId of departmentIds) {
    const templates = db
      .select({ templateId: taskAssignments.templateId })
      .from(taskAssignments)
      .where(
        and(
          eq(taskAssignments.assigneeType, "DEPARTMENT"),
          eq(taskAssignments.departmentId, departmentId),
        ),
      )
      .all();
    for (const template of templates) {
      generateOccurrences({
        templateId: template.templateId,
        userId,
        from: today,
        to: today,
        skipCursorUpdate: true,
      });
    }
  }
}

function applyDepartmentMembership(userId: number, departmentIds: number[]) {
  const { added, removed } = setUserDepartments(userId, departmentIds);
  for (const departmentId of removed) {
    removeDeptOnlyPendingOnTransfer({ userId, oldDepartmentId: departmentId });
  }
  generateDepartmentTasks(userId, added);
}

function parsePermissions(formData: FormData): Permission[] {
  return formData
    .getAll("permissions")
    .map(String)
    .filter((p): p is Permission =>
      (PERMISSIONS as readonly string[]).includes(p),
    );
}

export async function createStaffAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("staff.manage");

    const parsed = createStaffSchema.safeParse({
      username: formData.get("username"),
      fullName: formData.get("fullName"),
      nationalCode: formData.get("nationalCode") ?? "",
      phone: formData.get("phone") ?? "",
      email: formData.get("email") ?? "",
      position: formData.get("position") ?? "",
      departmentId: null,
      role: formData.get("role") || "STAFF",
      hireDate: formData.get("hireDate") ?? "",
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }

    const data = parsed.data;
    assertCanAssignRole(actor, data.role);
    let departmentIds = parseDepartmentIds(
      formData.get("departmentIds") || formData.get("departmentId"),
    );
    const deptError = unknownDepartmentError(departmentIds);
    if (deptError) return { ok: false, error: deptError };

    if (actor.role === "MANAGER") {
      if (actor.departmentIds.length === 0) {
        return { ok: false, error: "دپارتمان سرپرست مشخص نیست" };
      }
      departmentIds = [actor.departmentIds[0]!];
      if (data.role !== "STAFF") {
        return { ok: false, error: "سرپرست فقط می‌تواند پرسنل ایجاد کند" };
      }
    }

    const exists = db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .get();
    if (exists) {
      return { ok: false, error: "این نام کاربری قبلاً ثبت شده است" };
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const row = db
      .insert(users)
      .values({
        username: data.username,
        passwordHash,
        role: data.role,
        fullName: data.fullName,
        fullNameNormalized: normalizePersianText(data.fullName),
        nationalCode: data.nationalCode || null,
        phone: data.phone || null,
        email: data.email || null,
        position: data.position || null,
        departmentId: departmentIds[0] ?? null,
        departmentJoinedAt: departmentIds.length > 0 ? todayTehran() : null,
        hireDate: data.hireDate || null,
        mustChangePassword: true,
        isActive: true,
        sessionVersion: 1,
      })
      .returning({ id: users.id })
      .get();

    setUserDepartments(row.id, departmentIds);
    generateDepartmentTasks(row.id, departmentIds);

    const perms: Permission[] =
      actor.role === "MANAGER" ? [] : parsePermissions(formData);
    for (const permission of perms) {
      db.insert(userPermissions)
        .values({ userId: row.id, permission })
        .run();
    }

    writeAuditLog({
      actorId: actor.id,
      action: "staff.create",
      entity: "user",
      entityId: row.id,
      meta: {
        username: data.username,
        role: data.role,
        departmentIds,
        permissions: perms,
      },
    });

    revalidatePath("/admin/staff");
    // رمز فقط یک‌بار به کلاینت برمی‌گردد — لاگ نمی‌شود
    return { ok: true, generatedPassword: tempPassword };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateStaffAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("staff.manage");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) {
      return { ok: false, error: "شناسه نامعتبر است" };
    }

    const target = assertUserInScope(actor, id);

    const parsed = createStaffSchema
      .omit({ username: true })
      .extend({
        username: usernameSchema.optional(),
      })
      .safeParse({
        username: formData.get("username") || target.username,
        fullName: formData.get("fullName"),
        nationalCode: formData.get("nationalCode") ?? "",
        phone: formData.get("phone") ?? "",
        email: formData.get("email") ?? "",
        position: formData.get("position") ?? "",
        departmentId: null,
        role: formData.get("role") || target.role,
        hireDate: formData.get("hireDate") ?? "",
      });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }

    const data = parsed.data;
    const newRole = data.role as Role;
    assertCanAssignRole(actor, newRole, id);
    const departmentIds =
      actor.role === "MANAGER"
        ? departmentIdsForUser(id)
        : parseDepartmentIds(
            formData.get("departmentIds") || formData.get("departmentId"),
          );
    if (actor.role !== "MANAGER") {
      const deptError = unknownDepartmentError(departmentIds);
      if (deptError) return { ok: false, error: deptError };
    }

    if (actor.role === "MANAGER") {
      if (newRole !== "STAFF") {
        return { ok: false, error: "سرپرست فقط نقش پرسنل را می‌تواند نگه دارد" };
      }
    }

    if (id === actor.id && newRole !== actor.role) {
      return { ok: false, error: "نمی‌توانید نقش خود را تغییر دهید" };
    }

    const previousIds = departmentIdsForUser(id);

    db.update(users)
      .set({
        fullName: data.fullName,
        fullNameNormalized: normalizePersianText(data.fullName),
        nationalCode: data.nationalCode || null,
        phone: data.phone || null,
        email: data.email || null,
        position: data.position || null,
        role: newRole,
        hireDate: data.hireDate || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .run();

    applyDepartmentMembership(id, departmentIds);

    writeAuditLog({
      actorId: actor.id,
      action: "staff.update",
      entity: "user",
      entityId: id,
      meta: {
        role: newRole,
        departmentIds,
        departmentChanged:
          previousIds.join(",") !== departmentIds.join(","),
      },
    });

    revalidatePath("/admin/staff");
    revalidatePath(`/admin/staff/${id}`);
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function setStaffPermissionsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireUser({ roles: ["ADMIN"] });
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) {
      return { ok: false, error: "شناسه نامعتبر است" };
    }

    assertUserInScope(actor, id);
    assertCanModifyPermissions(actor, id);

    const perms = parsePermissions(formData);
    db.delete(userPermissions).where(eq(userPermissions.userId, id)).run();
    for (const permission of perms) {
      db.insert(userPermissions)
        .values({ userId: id, permission })
        .run();
    }

    writeAuditLog({
      actorId: actor.id,
      action: "staff.permissions",
      entity: "user",
      entityId: id,
      meta: { permissions: perms },
    });

    revalidatePath(`/admin/staff/${id}`);
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function softDeleteStaffAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("staff.manage");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) {
      return { ok: false, error: "شناسه نامعتبر است" };
    }

    const target = assertUserInScope(actor, id);
    assertCanDeactivate(actor, target);

    bumpSessionVersion(id);
    db.update(users)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .run();

    writeAuditLog({
      actorId: actor.id,
      action: "staff.soft_delete",
      entity: "user",
      entityId: id,
      meta: { username: target.username },
    });

    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function setStaffActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("staff.manage");
    const id = Number(formData.get("id"));
    const isActive = formData.get("isActive") === "true";
    if (!Number.isInteger(id)) {
      return { ok: false, error: "شناسه نامعتبر است" };
    }

    const target = assertUserInScope(actor, id);
    if (!isActive) {
      assertCanDeactivate(actor, target);
    }

    // فعال‌سازی مجدد از soft-delete فقط توسط ADMIN
    if (target.deletedAt && isActive && actor.role !== "ADMIN") {
      return { ok: false, error: "فقط مدیر کل می‌تواند حساب حذف‌شده را بازگرداند" };
    }

    bumpSessionVersion(id);
    db.update(users)
      .set({
        isActive,
        deletedAt: isActive ? null : target.deletedAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .run();

    writeAuditLog({
      actorId: actor.id,
      action: isActive ? "staff.activate" : "staff.deactivate",
      entity: "user",
      entityId: id,
    });

    revalidatePath("/admin/staff");
    revalidatePath(`/admin/staff/${id}`);
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function resetStaffPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("staff.manage");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) {
      return { ok: false, error: "شناسه نامعتبر است" };
    }

    const target = assertUserInScope(actor, id);
    if (actor.role === "MANAGER" && target.role !== "STAFF") {
      return { ok: false, error: "سرپرست فقط رمز پرسنل را می‌تواند ریست کند" };
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const nextVersion = bumpSessionVersion(id);

    db.update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        sessionVersion: nextVersion,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .run();

    writeAuditLog({
      actorId: actor.id,
      action: "staff.reset_password",
      entity: "user",
      entityId: id,
      meta: { username: target.username },
    });

    revalidatePath(`/admin/staff/${id}`);
    return { ok: true, generatedPassword: tempPassword };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function uploadStaffAvatarAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireUser();
    const id = Number(formData.get("id") || actor.id);
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return { ok: false, error: "فایل انتخاب نشده است" };
    }

    if (actor.role === "STAFF" && id !== actor.id) {
      return { ok: false, error: "دسترسی غیرمجاز" };
    }
    if (actor.role === "ADMIN" || actor.role === "MANAGER") {
      if (id !== actor.id) {
        await requirePermission("staff.manage");
        assertUserInScope(actor, id);
      }
    }

    const relative = await saveAvatarFile(id, file);
    db.update(users)
      .set({ avatarPath: relative, updatedAt: new Date() })
      .where(eq(users.id, id))
      .run();

    writeAuditLog({
      actorId: actor.id,
      action: "staff.avatar",
      entity: "user",
      entityId: id,
    });

    revalidatePath(`/admin/staff/${id}`);
    revalidatePath("/me/profile");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function listActiveStaffIdsInDepartment(
  departmentId: number,
): Promise<number[]> {
  return userIdsInDepartments([departmentId], { activeOnly: true });
}

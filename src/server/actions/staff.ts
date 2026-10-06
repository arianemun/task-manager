"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  PERMISSIONS,
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
import { onUserDepartmentChanged } from "@/server/services/occurrence-generate";
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
      departmentId: formData.get("departmentId") || null,
      role: formData.get("role") || "STAFF",
      hireDate: formData.get("hireDate") ?? "",
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }

    const data = parsed.data;
    assertCanAssignRole(actor, data.role);

    if (actor.role === "MANAGER") {
      if (!actor.departmentId) {
        return { ok: false, error: "دپارتمان سرپرست مشخص نیست" };
      }
      data.departmentId = actor.departmentId;
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
        departmentId: data.departmentId ?? null,
        departmentJoinedAt: data.departmentId ? todayTehran() : null,
        hireDate: data.hireDate || null,
        mustChangePassword: true,
        isActive: true,
        sessionVersion: 1,
      })
      .returning({ id: users.id })
      .get();

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
        departmentId: data.departmentId,
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
        departmentId: formData.get("departmentId") || null,
        role: formData.get("role") || target.role,
        hireDate: formData.get("hireDate") ?? "",
      });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "نامعتبر" };
    }

    const data = parsed.data;
    const newRole = data.role as Role;
    assertCanAssignRole(actor, newRole, id);

    if (actor.role === "MANAGER") {
      data.departmentId = actor.departmentId;
      if (newRole !== "STAFF") {
        return { ok: false, error: "سرپرست فقط نقش پرسنل را می‌تواند نگه دارد" };
      }
    }

    if (id === actor.id && newRole !== actor.role) {
      return { ok: false, error: "نمی‌توانید نقش خود را تغییر دهید" };
    }

    const oldDeptId = target.departmentId;
    const newDeptId = data.departmentId ?? null;
    const deptChanged = oldDeptId !== newDeptId;

    db.update(users)
      .set({
        fullName: data.fullName,
        fullNameNormalized: normalizePersianText(data.fullName),
        nationalCode: data.nationalCode || null,
        phone: data.phone || null,
        email: data.email || null,
        position: data.position || null,
        departmentId: newDeptId,
        role: newRole,
        hireDate: data.hireDate || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .run();

    if (deptChanged) {
      // department_joined_at + پاک‌سازی PENDING دپارتمان قبلی + generate دپارتمان جدید
      onUserDepartmentChanged({
        userId: id,
        oldDepartmentId: oldDeptId,
        newDepartmentId: newDeptId,
      });
    }

    writeAuditLog({
      actorId: actor.id,
      action: "staff.update",
      entity: "user",
      entityId: id,
      meta: {
        role: newRole,
        departmentId: data.departmentId,
        departmentChanged: deptChanged,
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
  return db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.departmentId, departmentId),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .all()
    .map((r) => r.id);
}

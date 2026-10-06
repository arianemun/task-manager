import type { Permission, Role } from "@/db/schema";
import { PERMISSIONS } from "@/db/schema";

/** مجوزهای ضمنی هر نقش (علاوه بر user_permissions) */
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: [
    "tasks.create",
    "tasks.assign",
    "staff.manage",
    "reports.view_department",
    "reports.export",
    "announcements.manage",
  ],
  STAFF: [],
};

export function resolvePermissions(
  role: Role,
  extra: Permission[] = [],
): Permission[] {
  const set = new Set<Permission>([
    ...ROLE_DEFAULT_PERMISSIONS[role],
    ...extra,
  ]);
  return [...set];
}

export function hasPermission(
  permissions: readonly Permission[],
  required: Permission,
): boolean {
  return permissions.includes(required);
}

export function hasAnyPermission(
  permissions: readonly Permission[],
  required: readonly Permission[],
): boolean {
  return required.some((p) => permissions.includes(p));
}

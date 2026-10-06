import { and, asc, count, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  staffNotes,
  userPermissions,
  users,
  type Permission,
} from "@/db/schema";
import type { AuthUser } from "@/lib/auth/user";
import {
  departmentIdsForUser,
  userInDepartmentsSql,
} from "@/lib/departments/membership";
import {
  assertUserInScope,
  notDeleted,
  scopeUsersQuery,
} from "@/lib/scope/users";
import { toSearchNeedle } from "@/lib/validation/iran";

export type StaffListFilters = {
  q?: string;
  departmentId?: number | null;
  status?: "active" | "inactive" | "all";
  page?: number;
  pageSize?: number;
};

export function listStaffForActor(
  actor: AuthUser,
  filters: StaffListFilters = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions: SQL[] = [];
  const scope = scopeUsersQuery(actor);
  if (scope) conditions.push(scope);
  else conditions.push(notDeleted());

  if (filters.status === "active" || !filters.status) {
    conditions.push(eq(users.isActive, true));
  } else if (filters.status === "inactive") {
    conditions.push(eq(users.isActive, false));
  }

  if (filters.departmentId && actor.role === "ADMIN") {
    conditions.push(userInDepartmentsSql([filters.departmentId]));
  }

  if (filters.q?.trim()) {
    const needle = `%${toSearchNeedle(filters.q)}%`;
    conditions.push(
      or(
        like(users.fullNameNormalized, needle),
        like(users.username, `%${filters.q.trim().toLowerCase()}%`),
        like(users.phone, `%${filters.q.trim()}%`),
      )!,
    );
  }

  const where = and(...conditions);

  const total =
    db.select({ c: count() }).from(users).where(where).get()?.c ?? 0;

  const rows = db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      phone: users.phone,
      position: users.position,
      isActive: users.isActive,
      departmentId: users.departmentId,
      departmentName: sql<string | null>`coalesce(
        (
          select group_concat(d.name, '، ')
          from user_departments ud
          inner join departments d on d.id = ud.department_id
          where ud.user_id = ${users.id}
        ),
        ${departments.name}
      )`,
      sourceTaskCount: filters.departmentId
        ? sql<number>`(
            select count(*) from task_occurrences
            where user_id = ${users.id}
              and source_department_id = ${filters.departmentId}
          )`.mapWith(Number)
        : sql<number>`(
            select count(*) from task_occurrences
            where user_id = ${users.id}
          )`.mapWith(Number),
      lastLoginAt: users.lastLoginAt,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(where)
    .orderBy(asc(users.fullName))
    .limit(pageSize)
    .offset(offset)
    .all();

  return { rows, total, page, pageSize };
}

export function getStaffDetailForActor(actor: AuthUser, userId: number) {
  const user = assertUserInScope(actor, userId);

  const departmentIds = departmentIdsForUser(userId);
  const memberships =
    departmentIds.length === 0
      ? []
      : db
          .select()
          .from(departments)
          .where(inArray(departments.id, departmentIds))
          .orderBy(asc(departments.name))
          .all();
  const department = memberships[0] ?? null;

  const permissions = db
    .select({ permission: userPermissions.permission })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId))
    .all()
    .map((p) => p.permission as Permission);

  const notes = db
    .select({
      id: staffNotes.id,
      title: staffNotes.title,
      body: staffNotes.body,
      createdAt: staffNotes.createdAt,
      authorName: users.fullName,
    })
    .from(staffNotes)
    .innerJoin(users, eq(staffNotes.authorId, users.id))
    .where(eq(staffNotes.userId, userId))
    .orderBy(desc(staffNotes.createdAt))
    .all();

  return { user, department, departments: memberships, permissions, notes };
}

export function listDepartmentsForSelect(actor: AuthUser) {
  if (actor.role === "MANAGER") {
    if (actor.departmentIds.length === 0) return [];
    return db
      .select()
      .from(departments)
      .where(inArray(departments.id, actor.departmentIds))
      .orderBy(asc(departments.name))
      .all();
  }
  return db.select().from(departments).orderBy(asc(departments.name)).all();
}

export function listAllDepartments() {
  return db
    .select({
      id: departments.id,
      name: departments.name,
      managerId: departments.managerId,
      createdAt: departments.createdAt,
      memberCount: sql<number>`(
        select count(distinct member_id) from (
          select user_departments.user_id as member_id
          from user_departments
          inner join users on users.id = user_departments.user_id
          where user_departments.department_id = ${departments.id}
            and users.deleted_at is null
          union
          select users.id as member_id
          from users
          where users.department_id = ${departments.id}
            and users.deleted_at is null
            and not exists (
              select 1 from user_departments
              where user_departments.user_id = users.id
            )
        )
      )`.mapWith(Number),
    })
    .from(departments)
    .orderBy(asc(departments.name))
    .all();
}

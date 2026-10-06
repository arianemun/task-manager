import { and, asc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { departments, userDepartments, users } from "@/db/schema";
import { todayTehran, type GDate } from "@/lib/dates";

export type DepartmentMembership = {
  departmentId: number;
  joinedAt: GDate;
};

function legacyOnlySql(): SQL {
  return sql`not exists (select 1 from user_departments where user_departments.user_id = ${users.id})`;
}

/** عضویت‌های ذخیره‌شده. اگر ردیفی نباشد، دپارتمان تکی قدیمی برمی‌گردد. */
export function membershipsForUser(userId: number): DepartmentMembership[] {
  const rows = db
    .select({
      departmentId: userDepartments.departmentId,
      joinedAt: userDepartments.joinedAt,
    })
    .from(userDepartments)
    .where(eq(userDepartments.userId, userId))
    .all();
  if (rows.length > 0) {
    return rows.map((row) => ({
      departmentId: row.departmentId,
      joinedAt: row.joinedAt as GDate,
    }));
  }

  const user = db
    .select({
      departmentId: users.departmentId,
      departmentJoinedAt: users.departmentJoinedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!user?.departmentId) return [];
  return [
    {
      departmentId: user.departmentId,
      joinedAt: (user.departmentJoinedAt ?? todayTehran()) as GDate,
    },
  ];
}

export function departmentIdsForUser(userId: number): number[] {
  return membershipsForUser(userId).map((row) => row.departmentId);
}

export function sharesDepartment(
  left: number[],
  right: number[],
): boolean {
  return left.some((id) => right.includes(id));
}

/** کاربران فعال یک دپارتمان، با تاریخ پیوستن همان عضویت. */
export function activeMembersOfDepartment(departmentId: number): Array<{
  user: typeof users.$inferSelect;
  joinedAt: GDate | null;
}> {
  const linked = db
    .select({
      user: users,
      joinedAt: userDepartments.joinedAt,
    })
    .from(userDepartments)
    .innerJoin(users, eq(users.id, userDepartments.userId))
    .where(
      and(
        eq(userDepartments.departmentId, departmentId),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .all()
    .map((row) => ({
      user: row.user,
      joinedAt: row.joinedAt as GDate,
    }));

  const legacy = db
    .select()
    .from(users)
    .where(
      and(
        eq(users.departmentId, departmentId),
        eq(users.isActive, true),
        isNull(users.deletedAt),
        legacyOnlySql(),
      ),
    )
    .all()
    .map((user) => ({
      user,
      joinedAt: (user.departmentJoinedAt ?? null) as GDate | null,
    }));

  return [...linked, ...legacy];
}

export function userIdsInDepartments(
  departmentIds: number[],
  options?: { activeOnly?: boolean },
): number[] {
  if (departmentIds.length === 0) return [];
  const activeOnly = options?.activeOnly ?? false;
  const linked = db
    .select({ id: users.id })
    .from(userDepartments)
    .innerJoin(users, eq(users.id, userDepartments.userId))
    .where(
      and(
        inArray(userDepartments.departmentId, departmentIds),
        isNull(users.deletedAt),
        activeOnly ? eq(users.isActive, true) : undefined,
      ),
    )
    .all()
    .map((row) => row.id);

  const legacy = db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.departmentId, departmentIds),
        isNull(users.deletedAt),
        activeOnly ? eq(users.isActive, true) : undefined,
        legacyOnlySql(),
      ),
    )
    .all()
    .map((row) => row.id);

  return [...new Set([...linked, ...legacy])];
}

export function userInDepartmentsSql(departmentIds: number[]): SQL {
  if (departmentIds.length === 0) return sql`1 = 0`;
  const list = sql.join(
    departmentIds.map((id) => sql`${id}`),
    sql`, `,
  );
  return sql`(
    ${users.id} in (
      select user_id from user_departments where department_id in (${list})
    )
    or (
      ${users.departmentId} in (${list})
      and ${legacyOnlySql()}
    )
  )`;
}

export function departmentNamesForUser(userId: number): string {
  const ids = departmentIdsForUser(userId);
  if (ids.length === 0) return "";
  const rows = db
    .select({ name: departments.name })
    .from(departments)
    .where(inArray(departments.id, ids))
    .orderBy(asc(departments.name))
    .all();
  return rows.map((row) => row.name).join("، ");
}

/**
 * عضویت‌ها را با لیست جدید عوض می‌کند.
 * دپارتمان‌های قبلی تاریخ پیوستنشان را نگه می‌دارند.
 */
export function setUserDepartments(
  userId: number,
  nextIds: number[],
): { added: number[]; removed: number[] } {
  const unique = [...new Set(nextIds)];
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return { added: [], removed: [] };

  const existing = db
    .select()
    .from(userDepartments)
    .where(eq(userDepartments.userId, userId))
    .all();
  const currentIds = existing.length
    ? existing.map((row) => row.departmentId)
    : user.departmentId
      ? [user.departmentId]
      : [];
  const removed = currentIds.filter((id) => !unique.includes(id));
  const added = unique.filter((id) => !currentIds.includes(id));
  const today = todayTehran();

  db.transaction((tx) => {
    if (
      existing.length === 0 &&
      user.departmentId &&
      unique.includes(user.departmentId)
    ) {
      tx.insert(userDepartments)
        .values({
          userId,
          departmentId: user.departmentId,
          joinedAt: user.departmentJoinedAt ?? today,
        })
        .onConflictDoNothing()
        .run();
    }
    for (const departmentId of added) {
      tx.insert(userDepartments)
        .values({ userId, departmentId, joinedAt: today })
        .onConflictDoNothing()
        .run();
    }
    for (const departmentId of removed) {
      tx.delete(userDepartments)
        .where(
          and(
            eq(userDepartments.userId, userId),
            eq(userDepartments.departmentId, departmentId),
          ),
        )
        .run();
    }

    const primary = unique[0] ?? null;
    const primaryRow = primary
      ? tx
          .select({ joinedAt: userDepartments.joinedAt })
          .from(userDepartments)
          .where(
            and(
              eq(userDepartments.userId, userId),
              eq(userDepartments.departmentId, primary),
            ),
          )
          .get()
      : null;
    tx.update(users)
      .set({
        departmentId: primary,
        departmentJoinedAt: primary ? (primaryRow?.joinedAt ?? today) : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .run();
  });

  return { added, removed };
}

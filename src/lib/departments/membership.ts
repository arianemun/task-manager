import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, departments, userDepartments, users } from "@/db/schema";
import { syncDepartmentChat } from "@/lib/chat/store";
import { compareGDate, todayTehran, type GDate } from "@/lib/dates";
import { currentMembershipSql } from "@/lib/departments/intervals";

export {
  currentMembershipSql,
  periodInsideMembership,
  wasMemberAtPeriodSql,
  type MembershipInterval,
} from "@/lib/departments/intervals";

export type DepartmentMembership = {
  departmentId: number;
  joinedAt: GDate;
};

type MembershipTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function legacyOnlySql(): SQL {
  return sql`not exists (select 1 from user_departments where user_departments.user_id = ${users.id})`;
}

function hasAnyMembership(userId: number): boolean {
  return Boolean(
    db
      .select({ id: userDepartments.id })
      .from(userDepartments)
      .where(eq(userDepartments.userId, userId))
      .get(),
  );
}

/** عضویت‌های باز. اگر هیچ ردیفی نباشد، دپارتمان تکی قدیمی برمی‌گردد. */
export function membershipsForUser(userId: number): DepartmentMembership[] {
  const rows = db
    .select({
      departmentId: userDepartments.departmentId,
      joinedAt: userDepartments.joinedAt,
    })
    .from(userDepartments)
    .where(and(eq(userDepartments.userId, userId), currentMembershipSql()))
    .all();
  if (rows.length > 0) {
    return rows.map((row) => ({
      departmentId: row.departmentId,
      joinedAt: row.joinedAt as GDate,
    }));
  }
  if (hasAnyMembership(userId)) return [];

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

export function sharesDepartment(left: number[], right: number[]): boolean {
  return left.some((id) => right.includes(id));
}

/** کاربران فعال یک دپارتمان، با تاریخ پیوستن عضویت باز. */
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
        currentMembershipSql(),
        eq(users.isActive, true),
        sql`${users.deletedAt} is null`,
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
        sql`${users.deletedAt} is null`,
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
        currentMembershipSql(),
        sql`${users.deletedAt} is null`,
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
        sql`${users.deletedAt} is null`,
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
      select user_id from user_departments
      where department_id in (${list})
        and ${currentMembershipSql("user_departments")}
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

function auditMembership(
  tx: MembershipTx,
  input: {
    actorId: number | null;
    action: "department.join" | "department.leave";
    userId: number;
    departmentId: number;
    at: GDate;
  },
): void {
  tx.insert(auditLogs)
    .values({
      actorId: input.actorId,
      action: input.action,
      entity: "user",
      entityId: String(input.userId),
      meta: {
        departmentId: input.departmentId,
        at: input.at,
      },
    })
    .run();
}

function closeMembershipTx(
  tx: MembershipTx,
  input: {
    userId: number;
    departmentId: number;
    leftAt: GDate;
    actorId: number | null;
    legacyJoinedAt?: GDate | null;
  },
): void {
  const updated = tx
    .update(userDepartments)
    .set({ leftAt: input.leftAt })
    .where(
      and(
        eq(userDepartments.userId, input.userId),
        eq(userDepartments.departmentId, input.departmentId),
        currentMembershipSql(),
      ),
    )
    .run();
  if (updated.changes > 0) {
    auditMembership(tx, {
      actorId: input.actorId,
      action: "department.leave",
      userId: input.userId,
      departmentId: input.departmentId,
      at: input.leftAt,
    });
    return;
  }

  const any = tx
    .select({ id: userDepartments.id })
    .from(userDepartments)
    .where(
      and(
        eq(userDepartments.userId, input.userId),
        eq(userDepartments.departmentId, input.departmentId),
      ),
    )
    .get();
  if (any || !input.legacyJoinedAt) return;

  const joinedAt =
    compareGDate(input.legacyJoinedAt, input.leftAt) <= 0
      ? input.legacyJoinedAt
      : input.leftAt;
  tx.insert(userDepartments)
    .values({
      userId: input.userId,
      departmentId: input.departmentId,
      joinedAt,
      leftAt: input.leftAt,
    })
    .run();
  auditMembership(tx, {
    actorId: input.actorId,
    action: "department.leave",
    userId: input.userId,
    departmentId: input.departmentId,
    at: input.leftAt,
  });
}

function openMembershipTx(
  tx: MembershipTx,
  input: {
    userId: number;
    departmentId: number;
    joinedAt: GDate;
    actorId: number | null;
  },
): void {
  const open = tx
    .select({ id: userDepartments.id })
    .from(userDepartments)
    .where(
      and(
        eq(userDepartments.userId, input.userId),
        eq(userDepartments.departmentId, input.departmentId),
        currentMembershipSql(),
      ),
    )
    .get();
  if (open) return;

  tx.insert(userDepartments)
    .values({
      userId: input.userId,
      departmentId: input.departmentId,
      joinedAt: input.joinedAt,
    })
    .run();
  auditMembership(tx, {
    actorId: input.actorId,
    action: "department.join",
    userId: input.userId,
    departmentId: input.departmentId,
    at: input.joinedAt,
  });
}

/**
 * عضویت‌های باز را با لیست جدید عوض می‌کند.
 * خروج left_at می‌گذارد. پیوستن دوباره ردیف تازه می‌سازد.
 */
export function setUserDepartments(
  userId: number,
  nextIds: number[],
  actorId: number | null = null,
): { added: number[]; removed: number[] } {
  const unique = [...new Set(nextIds)];
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return { added: [], removed: [] };

  const existing = db
    .select()
    .from(userDepartments)
    .where(eq(userDepartments.userId, userId))
    .all();
  const openIds = existing
    .filter((row) => row.leftAt == null)
    .map((row) => row.departmentId);
  const currentIds =
    existing.length > 0
      ? openIds
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
      const joinedAt = (user.departmentJoinedAt ?? today) as GDate;
      tx.insert(userDepartments)
        .values({
          userId,
          departmentId: user.departmentId,
          joinedAt,
        })
        .run();
      auditMembership(tx, {
        actorId,
        action: "department.join",
        userId,
        departmentId: user.departmentId,
        at: joinedAt,
      });
    }
    for (const departmentId of removed) {
      closeMembershipTx(tx, {
        userId,
        departmentId,
        leftAt: today,
        actorId,
        legacyJoinedAt:
          existing.length === 0 && user.departmentId === departmentId
            ? ((user.departmentJoinedAt ?? today) as GDate)
            : null,
      });
    }
    for (const departmentId of added) {
      openMembershipTx(tx, {
        userId,
        departmentId,
        joinedAt: today,
        actorId,
      });
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
              currentMembershipSql(),
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

  for (const departmentId of [...added, ...removed]) {
    syncDepartmentChat(departmentId);
  }

  return { added, removed };
}

export function closeDepartmentMembership(input: {
  userId: number;
  departmentId: number;
  leftAt: GDate;
  actorId?: number | null;
  legacyJoinedAt?: GDate | null;
}): void {
  db.transaction((tx) => {
    closeMembershipTx(tx, {
      userId: input.userId,
      departmentId: input.departmentId,
      leftAt: input.leftAt,
      actorId: input.actorId ?? null,
      legacyJoinedAt: input.legacyJoinedAt,
    });
  });
  syncDepartmentChat(input.departmentId);
}

export function openDepartmentMembership(input: {
  userId: number;
  departmentId: number;
  joinedAt: GDate;
  actorId?: number | null;
}): void {
  db.transaction((tx) => {
    openMembershipTx(tx, {
      userId: input.userId,
      departmentId: input.departmentId,
      joinedAt: input.joinedAt,
      actorId: input.actorId ?? null,
    });
  });
  syncDepartmentChat(input.departmentId);
}

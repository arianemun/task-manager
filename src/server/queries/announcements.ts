import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcementReads,
  announcementTargets,
  announcements,
  departments,
  users,
} from "@/db/schema";
import type { AuthUser } from "@/lib/auth/user";

export function listAnnouncementsForAdmin(actor: AuthUser) {
  const rows = db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      audience: announcements.audience,
      departmentId: announcements.departmentId,
      departmentName: departments.name,
      isPinned: announcements.isPinned,
      createdAt: announcements.createdAt,
      authorName: users.fullName,
    })
    .from(announcements)
    .leftJoin(departments, eq(announcements.departmentId, departments.id))
    .innerJoin(users, eq(announcements.authorId, users.id))
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .all();

  if (actor.role === "MANAGER") {
    return rows.filter(
      (r) =>
        r.audience === "ALL" ||
        (r.audience === "DEPARTMENT" && r.departmentId === actor.departmentId),
    );
  }
  return rows;
}

export function listAnnouncementsForStaff(actor: AuthUser) {
  const now = Date.now();
  const all = db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .all();

  const targeted = new Set(
    db
      .select({ announcementId: announcementTargets.announcementId })
      .from(announcementTargets)
      .where(eq(announcementTargets.userId, actor.id))
      .all()
      .map((t) => t.announcementId),
  );

  const reads = new Set(
    db
      .select({ announcementId: announcementReads.announcementId })
      .from(announcementReads)
      .where(eq(announcementReads.userId, actor.id))
      .all()
      .map((r) => r.announcementId),
  );

  const visible = all.filter((a) => {
    if (a.startsAt && a.startsAt.getTime() > now) return false;
    if (a.endsAt && a.endsAt.getTime() < now) return false;
    if (a.audience === "ALL") return true;
    if (a.audience === "DEPARTMENT") {
      return a.departmentId != null && a.departmentId === actor.departmentId;
    }
    return targeted.has(a.id);
  });

  // pinned اول
  visible.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return visible.map((a) => ({
    ...a,
    isRead: reads.has(a.id),
  }));
}

export function countUnreadAnnouncements(actor: AuthUser): number {
  return listAnnouncementsForStaff(actor).filter((a) => !a.isRead).length;
}

/** هنگام باز شدن صفحه اطلاعات — اطلاعیه‌های نخوانده خوانده شوند */
export function markAnnouncementsReadForUser(
  userId: number,
  announcementIds: number[],
): void {
  for (const announcementId of announcementIds) {
    const existing = db
      .select()
      .from(announcementReads)
      .where(
        and(
          eq(announcementReads.announcementId, announcementId),
          eq(announcementReads.userId, userId),
        ),
      )
      .get();
    if (!existing) {
      db.insert(announcementReads)
        .values({ announcementId, userId, readAt: new Date() })
        .run();
    }
  }
}

export function announcementReadCounts(announcementId: number): {
  read: number;
  total: number;
} {
  const ann = db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .get();
  if (!ann) return { read: 0, total: 0 };

  let total = 0;
  if (ann.audience === "ALL") {
    total =
      db
        .select({ c: sql<number>`count(*)`.mapWith(Number) })
        .from(users)
        .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
        .get()?.c ?? 0;
  } else if (ann.audience === "DEPARTMENT" && ann.departmentId) {
    total =
      db
        .select({ c: sql<number>`count(*)`.mapWith(Number) })
        .from(users)
        .where(
          and(
            eq(users.departmentId, ann.departmentId),
            eq(users.isActive, true),
            isNull(users.deletedAt),
          ),
        )
        .get()?.c ?? 0;
  } else {
    total =
      db
        .select({ c: sql<number>`count(*)`.mapWith(Number) })
        .from(announcementTargets)
        .where(eq(announcementTargets.announcementId, announcementId))
        .get()?.c ?? 0;
  }

  const read =
    db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(announcementReads)
      .where(eq(announcementReads.announcementId, announcementId))
      .get()?.c ?? 0;

  return { read, total };
}

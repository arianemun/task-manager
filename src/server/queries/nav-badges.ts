import { cache } from "react";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcementReads,
  announcementTargets,
  announcements,
  taskOccurrences,
  users,
} from "@/db/schema";
import type { AuthUser } from "@/lib/auth/user";
import { userInDepartmentsSql } from "@/lib/departments/membership";
import { countUnreadChats } from "@/lib/chat/store";
import { todayTehran } from "@/lib/dates";

/**
 * badgeهای منو — فقط COUNT سبک با ایندکس، یک‌بار در هر request (React cache).
 */
export const getNavBadges = cache(function getNavBadges(actor: AuthUser): {
  unread: number;
  unanswered: number;
  chat: number;
} {
  return {
    unread: countUnreadAnnouncementsFast(actor),
    unanswered:
      actor.role === "ADMIN" || actor.role === "MANAGER"
        ? countUnansweredTodayFast(actor)
        : 0,
    chat: countUnreadChats(actor.id),
  };
});

/** COUNT اطلاعیه‌های قابل‌مشاهدهٔ نخوانده — بدون بارگذاری لیست کامل */
function countUnreadAnnouncementsFast(actor: AuthUser): number {
  const now = Date.now();
  const rows = db
    .select({
      id: announcements.id,
      audience: announcements.audience,
      departmentId: announcements.departmentId,
      startsAt: announcements.startsAt,
      endsAt: announcements.endsAt,
    })
    .from(announcements)
    .all();

  if (rows.length === 0) return 0;

  const targeted = new Set(
    db
      .select({ announcementId: announcementTargets.announcementId })
      .from(announcementTargets)
      .where(eq(announcementTargets.userId, actor.id))
      .all()
      .map((t) => t.announcementId),
  );

  const readIds = new Set(
    db
      .select({ announcementId: announcementReads.announcementId })
      .from(announcementReads)
      .where(eq(announcementReads.userId, actor.id))
      .all()
      .map((r) => r.announcementId),
  );

  let n = 0;
  for (const a of rows) {
    if (a.startsAt && a.startsAt.getTime() > now) continue;
    if (a.endsAt && a.endsAt.getTime() < now) continue;
    if (readIds.has(a.id)) continue;
    if (a.audience === "ALL") {
      n += 1;
      continue;
    }
    if (a.audience === "DEPARTMENT") {
      if (
        a.departmentId != null &&
        actor.departmentIds.includes(a.departmentId)
      ) {
        n += 1;
      }
      continue;
    }
    if (targeted.has(a.id)) n += 1;
  }
  return n;
}

/**
 * تعداد occurrenceهای PENDING امروز در محدودهٔ نقش
 * (ایندکس: status + user_period / period_end).
 */
function countUnansweredTodayFast(actor: AuthUser): number {
  const today = todayTehran();
  const conditions = [
    eq(users.isActive, true),
    isNull(users.deletedAt),
    inArray(users.role, ["STAFF", "MANAGER"]),
  ];
  if (actor.role === "MANAGER" && actor.departmentIds.length > 0) {
    conditions.push(userInDepartmentsSql(actor.departmentIds));
  }

  const staffIds = db
    .select({ id: users.id })
    .from(users)
    .where(and(...conditions))
    .all()
    .map((r) => r.id);

  if (staffIds.length === 0) return 0;

  return (
    db
      .select({ c: count() })
      .from(taskOccurrences)
      .where(
        and(
          eq(taskOccurrences.status, "PENDING"),
          sql`${taskOccurrences.periodStart} <= ${today}`,
          sql`${taskOccurrences.periodEnd} >= ${today}`,
          inArray(taskOccurrences.userId, staffIds),
        ),
      )
      .get()?.c ?? 0
  );
}

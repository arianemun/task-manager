import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { taskOccurrences, taskTemplates, users } from "@/db/schema";

const CLOSING = ["DONE", "DONE_LATE", "NOT_DONE"] as const;

/** ردیفی که وضعیت بسته‌اش به نام شخص دیگری ثبت شده؛ باید DONE_BY_PEER باشد نه DONE. */
export function isCopiedForeignClose(row: {
  status: string;
  userId: number;
  completedByUserId: number | null;
}): boolean {
  return (
    row.completedByUserId != null &&
    row.completedByUserId !== row.userId &&
    (CLOSING as readonly string[]).includes(row.status)
  );
}

export function listCopiedForeignCloses() {
  return db
    .select({
      id: taskOccurrences.id,
      status: taskOccurrences.status,
      periodKey: taskOccurrences.periodKey,
      userId: taskOccurrences.userId,
      staff: users.fullName,
      completedByUserId: taskOccurrences.completedByUserId,
      templateId: taskOccurrences.templateId,
      title: taskTemplates.title,
    })
    .from(taskOccurrences)
    .innerJoin(users, eq(taskOccurrences.userId, users.id))
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(
      and(
        isNotNull(taskOccurrences.completedByUserId),
        sql`${taskOccurrences.completedByUserId} != ${taskOccurrences.userId}`,
        inArray(taskOccurrences.status, [...CLOSING]),
      ),
    )
    .all()
    .filter((row) =>
      isCopiedForeignClose({
        status: row.status,
        userId: row.userId,
        completedByUserId: row.completedByUserId,
      }),
    );
}

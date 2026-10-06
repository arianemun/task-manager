import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { taskOccurrences, users, type OccurrenceStatus } from "@/db/schema";
import { groupMemberUserIds } from "@/lib/tasks/group-work";

type ClosingStatus = Extract<OccurrenceStatus, "DONE" | "DONE_LATE" | "NOT_DONE">;

export type GroupOutcomeResult =
  | { mode: "personal" }
  | { mode: "closed" }
  | { mode: "blocked"; name: string };

/**
 * نتیجه کار گروهی را روی ردیف ثبت‌کننده و بقیه اعضای در انتظار همان دوره می‌نویسد.
 * ردیف مرخصی و پاسخی که قبلاً شخص دیگری داده بازنویسی نمی‌شود.
 */
export function recordGroupOutcome(input: {
  templateId: number;
  periodKey: string;
  completerUserId: number;
  sourceOccurrenceId: number;
  status: ClosingStatus;
  completedAt: Date;
  note: string | null;
  reasonCode: string | null;
  attachmentPath: string | null;
  editedAt: Date | null;
}): GroupOutcomeResult {
  const members = groupMemberUserIds(input.templateId);
  if (!members.includes(input.completerUserId)) {
    return { mode: "personal" };
  }

  let blockedName: string | null = null;

  db.transaction((tx) => {
    const siblings = tx
      .select()
      .from(taskOccurrences)
      .where(
        and(
          eq(taskOccurrences.templateId, input.templateId),
          eq(taskOccurrences.periodKey, input.periodKey),
          inArray(taskOccurrences.userId, members),
        ),
      )
      .all();

    const other = siblings.find(
      (row) =>
        row.completedByUserId != null &&
        row.completedByUserId !== input.completerUserId,
    );
    if (other?.completedByUserId) {
      const person = tx
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, other.completedByUserId))
        .get();
      blockedName = person?.fullName ?? "همکار";
      return;
    }

    const now = new Date();
    for (const row of siblings) {
      if (row.status === "EXCUSED" && row.id !== input.sourceOccurrenceId) {
        continue;
      }
      const isSource = row.id === input.sourceOccurrenceId;
      const coveredByCompleter = row.completedByUserId === input.completerUserId;
      const open = row.status === "PENDING";
      if (!isSource && !coveredByCompleter && !open) continue;

      tx.update(taskOccurrences)
        .set({
          status: input.status,
          completedAt: input.completedAt,
          note: input.note,
          reasonCode: input.reasonCode,
          attachmentPath: input.attachmentPath,
          completedByUserId: input.completerUserId,
          editedAt: isSource ? input.editedAt : row.editedAt,
          updatedAt: now,
        })
        .where(eq(taskOccurrences.id, row.id))
        .run();
    }
  });

  if (blockedName) return { mode: "blocked", name: blockedName };
  return { mode: "closed" };
}

/** ردیف‌های تازه‌ساختهٔ در انتظار را با نتیجهٔ قبلی همان دوره هم‌تراز می‌کند. */
export function syncPendingGroupClosures(templateIds?: number[]) {
  const clauses = [
    isNotNull(taskOccurrences.completedByUserId),
    inArray(taskOccurrences.status, ["DONE", "DONE_LATE", "NOT_DONE"]),
  ];
  if (templateIds && templateIds.length > 0) {
    clauses.push(inArray(taskOccurrences.templateId, templateIds));
  }

  const sources = db
    .select()
    .from(taskOccurrences)
    .where(and(...clauses))
    .all()
    .filter((row) => row.userId === row.completedByUserId && row.completedByUserId);

  const seen = new Set<string>();
  for (const source of sources) {
    const key = `${source.templateId}:${source.periodKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (
      source.status !== "DONE" &&
      source.status !== "DONE_LATE" &&
      source.status !== "NOT_DONE"
    ) {
      continue;
    }
    recordGroupOutcome({
      templateId: source.templateId,
      periodKey: source.periodKey,
      completerUserId: source.completedByUserId!,
      sourceOccurrenceId: source.id,
      status: source.status,
      completedAt: source.completedAt ?? new Date(),
      note: source.note,
      reasonCode: source.reasonCode,
      attachmentPath: source.attachmentPath,
      editedAt: source.editedAt,
    });
  }
}

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { taskOccurrences, taskTemplates, users, type OccurrenceStatus } from "@/db/schema";
import { groupMemberUserIds } from "@/lib/tasks/group-work";

type ClosingStatus = Extract<OccurrenceStatus, "DONE" | "DONE_LATE" | "NOT_DONE">;

export type GroupOutcomeResult =
  | { mode: "personal" }
  | { mode: "closed" }
  | { mode: "blocked"; name: string };

function isSharedTemplate(templateId: number): boolean {
  const template = db
    .select({ completionMode: taskTemplates.completionMode })
    .from(taskTemplates)
    .where(eq(taskTemplates.id, templateId))
    .get();
  return template?.completionMode === "SHARED";
}

/** DONE_BY_PEERهایی که به این occurrence اشاره دارند به PENDING برمی‌گردند. */
export function releaseSharedPeers(sourceOccurrenceId: number) {
  db.update(taskOccurrences)
    .set({
      status: "PENDING",
      completedAt: null,
      completedByUserId: null,
      doneByOccurrenceId: null,
      note: null,
      reasonCode: null,
      attachmentPath: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(taskOccurrences.doneByOccurrenceId, sourceOccurrenceId),
        eq(taskOccurrences.status, "DONE_BY_PEER"),
      ),
    )
    .run();
}

/**
 * INDIVIDUAL: هیچ ردیف دیگری عوض نمی‌شود.
 * SHARED + DONE/DONE_LATE: فقط ردیف انجام‌دهنده همان وضعیت را می‌گیرد؛
 * بقیه PENDING همان دوره DONE_BY_PEER با ارجاع به occurrence او می‌شوند.
 * SHARED + NOT_DONE: ردیف خودش NOT_DONE و DONE_BY_PEERهای وابسته PENDING.
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
  if (!isSharedTemplate(input.templateId)) return { mode: "personal" };

  const members = groupMemberUserIds(input.templateId);
  if (!members.includes(input.completerUserId)) return { mode: "personal" };

  const now = new Date();

  if (input.status === "NOT_DONE") {
    db.transaction((tx) => {
      tx.update(taskOccurrences)
        .set({
          status: "NOT_DONE",
          completedAt: input.completedAt,
          note: input.note,
          reasonCode: input.reasonCode,
          attachmentPath: input.attachmentPath,
          completedByUserId: input.completerUserId,
          doneByOccurrenceId: null,
          editedAt: input.editedAt,
          updatedAt: now,
        })
        .where(eq(taskOccurrences.id, input.sourceOccurrenceId))
        .run();

      tx.update(taskOccurrences)
        .set({
          status: "PENDING",
          completedAt: null,
          completedByUserId: null,
          doneByOccurrenceId: null,
          note: null,
          reasonCode: null,
          attachmentPath: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(taskOccurrences.doneByOccurrenceId, input.sourceOccurrenceId),
            eq(taskOccurrences.status, "DONE_BY_PEER"),
          ),
        )
        .run();
    });
    return { mode: "closed" };
  }

  let blockedName: string | null = null;

  db.transaction((tx) => {
    const source = tx
      .select({ sourceDepartmentId: taskOccurrences.sourceDepartmentId })
      .from(taskOccurrences)
      .where(eq(taskOccurrences.id, input.sourceOccurrenceId))
      .get();

    const siblings = tx
      .select()
      .from(taskOccurrences)
      .where(
        and(
          eq(taskOccurrences.templateId, input.templateId),
          eq(taskOccurrences.periodKey, input.periodKey),
          inArray(taskOccurrences.userId, members),
          source
            ? eq(
                taskOccurrences.sourceDepartmentId,
                source.sourceDepartmentId,
              )
            : undefined,
        ),
      )
      .all();

    const otherDone = siblings.find(
      (row) =>
        row.id !== input.sourceOccurrenceId &&
        (row.status === "DONE" || row.status === "DONE_LATE"),
    );
    if (otherDone) {
      const person = tx
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, otherDone.userId))
        .get();
      blockedName = person?.fullName ?? "همکار";
      return;
    }

    tx.update(taskOccurrences)
      .set({
        status: input.status,
        completedAt: input.completedAt,
        note: input.note,
        reasonCode: null,
        attachmentPath: input.attachmentPath,
        completedByUserId: input.completerUserId,
        doneByOccurrenceId: null,
        editedAt: input.editedAt,
        updatedAt: now,
      })
      .where(eq(taskOccurrences.id, input.sourceOccurrenceId))
      .run();

    for (const row of siblings) {
      if (row.id === input.sourceOccurrenceId) continue;
      if (row.status === "EXCUSED" || row.status === "MISSED" || row.status === "NOT_DONE") {
        continue;
      }
      tx.update(taskOccurrences)
        .set({
          status: "DONE_BY_PEER",
          completedAt: null,
          note: null,
          reasonCode: null,
          attachmentPath: null,
          completedByUserId: input.completerUserId,
          doneByOccurrenceId: input.sourceOccurrenceId,
          updatedAt: now,
        })
        .where(eq(taskOccurrences.id, row.id))
        .run();
    }
  });

  if (blockedName) return { mode: "blocked", name: blockedName };
  return { mode: "closed" };
}

/** occurrence تازه PENDING را با DONE قبلی همان دوره SHARED هم‌تراز می‌کند. */
export function syncPendingGroupClosures(templateIds?: number[]) {
  const sharedIds = db
    .select({ id: taskTemplates.id })
    .from(taskTemplates)
    .where(eq(taskTemplates.completionMode, "SHARED"))
    .all()
    .map((row) => row.id);
  const limited =
    templateIds && templateIds.length > 0
      ? sharedIds.filter((id) => templateIds.includes(id))
      : sharedIds;
  if (limited.length === 0) return;

  const sources = db
    .select()
    .from(taskOccurrences)
    .where(
      and(
        inArray(taskOccurrences.templateId, limited),
        inArray(taskOccurrences.status, ["DONE", "DONE_LATE"]),
        isNotNull(taskOccurrences.userId),
      ),
    )
    .all()
    .filter(
      (row) =>
        row.completedByUserId == null || row.completedByUserId === row.userId,
    );

  const seen = new Set<string>();
  for (const source of sources) {
    const key = `${source.templateId}:${source.periodKey}:${source.userId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (source.status !== "DONE" && source.status !== "DONE_LATE") continue;
    recordGroupOutcome({
      templateId: source.templateId,
      periodKey: source.periodKey,
      completerUserId: source.userId,
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

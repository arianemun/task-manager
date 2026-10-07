/**
 * گزارش فقط‌خواندنی برای پر کردن source_department_id.
 * این فرمان هیچ ردیفی نمی‌نویسد.
 *
 * قطعی: از اساین‌ها و عضویت فعلی، در period_start فقط یک دپارتمان ممکن است.
 * مبهم: هیچ مسیر معتبری نیست، یا بیش از یک دپارتمان نامزد است.
 * proposed همان قاعدهٔ resolveOccurrenceSource است و تا تأیید نوشته نمی‌شود.
 */
import "dotenv/config";
import { asc, eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import {
  auditLogs,
  departments,
  taskAssignments,
  taskOccurrences,
  taskTemplates,
  userDepartments,
  users,
} from "../src/db/schema";
import type { GDate } from "../src/lib/dates";
import {
  classifySourceBackfill,
  type SourceBackfillMembership,
} from "../src/lib/tasks/source-backfill";

const SAMPLE_LIMIT = 20;

/** نسبت‌هایی که برای این پایگاه تأیید شده‌اند. --apply جز این نقشه چیزی نمی‌نویسد. */
const CONFIRMED: Readonly<Record<number, number>> = {
  1: 1,
  2: 1,
  3: 1,
  74: 1,
  93: 3,
  149: 3,
};

const occurrenceRows = db
  .select({
    id: taskOccurrences.id,
    templateId: taskOccurrences.templateId,
    userId: taskOccurrences.userId,
    periodStart: taskOccurrences.periodStart,
    sourceDepartmentId: taskOccurrences.sourceDepartmentId,
  })
  .from(taskOccurrences)
  .orderBy(asc(taskOccurrences.id))
  .all();

const assignmentRows = db
  .select({
    templateId: taskAssignments.templateId,
    assigneeType: taskAssignments.assigneeType,
    userId: taskAssignments.userId,
    departmentId: taskAssignments.departmentId,
  })
  .from(taskAssignments)
  .all();

const membershipRows = db
  .select({
    userId: userDepartments.userId,
    departmentId: userDepartments.departmentId,
    joinedAt: userDepartments.joinedAt,
    leftAt: userDepartments.leftAt,
  })
  .from(userDepartments)
  .all();

const userRows = db
  .select({
    id: users.id,
    fullName: users.fullName,
    departmentId: users.departmentId,
    departmentJoinedAt: users.departmentJoinedAt,
  })
  .from(users)
  .all();

const assignmentsByTemplate = new Map<number, typeof assignmentRows>();
for (const row of assignmentRows) {
  const list = assignmentsByTemplate.get(row.templateId) ?? [];
  list.push(row);
  assignmentsByTemplate.set(row.templateId, list);
}

const membershipsByUser = new Map<number, SourceBackfillMembership[]>();
for (const row of membershipRows) {
  const list = membershipsByUser.get(row.userId) ?? [];
  list.push({
    departmentId: row.departmentId,
    joinedAt: row.joinedAt as GDate,
    leftAt: (row.leftAt as GDate | null) ?? null,
  });
  membershipsByUser.set(row.userId, list);
}

const usersById = new Map(userRows.map((row) => [row.id, row]));
const departmentName = new Map(
  db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .all()
    .map((row) => [row.id, row.name] as const),
);
const templateTitle = new Map(
  db
    .select({ id: taskTemplates.id, title: taskTemplates.title })
    .from(taskTemplates)
    .all()
    .map((row) => [row.id, row.title] as const),
);

function deptLabel(id: number): string {
  return `${id}:${departmentName.get(id) ?? "?"}`;
}

let definite = 0;
let ambiguous = 0;
let alreadySet = 0;
const definiteSamples: string[] = [];
const ambiguousSamples: string[] = [];
const proposed = new Map<number, number>();

for (const occurrence of occurrenceRows) {
  if (occurrence.sourceDepartmentId != null) {
    alreadySet += 1;
    continue;
  }
  const person = usersById.get(occurrence.userId);
  const stored = membershipsByUser.get(occurrence.userId) ?? [];
  const memberships =
    stored.length > 0
      ? stored
      : person?.departmentId
        ? [
            {
              departmentId: person.departmentId,
              joinedAt: (person.departmentJoinedAt ?? null) as GDate | null,
            },
          ]
        : [];
  const templateAssignments = (
    assignmentsByTemplate.get(occurrence.templateId) ?? []
  ).filter(
    (row) =>
      row.assigneeType === "DEPARTMENT" ||
      (row.assigneeType === "USER" && row.userId === occurrence.userId),
  );
  const verdict = classifySourceBackfill({
    periodStart: occurrence.periodStart as GDate,
    primaryDepartmentId: person?.departmentId ?? null,
    memberships,
    assignments: templateAssignments.map((row) => ({
      assigneeType: row.assigneeType,
      departmentId: row.departmentId,
    })),
  });
  const line = [
    `id=${occurrence.id}`,
    `user=${occurrence.userId}${person ? ` (${person.fullName})` : ""}`,
    `template=${occurrence.templateId} (${templateTitle.get(occurrence.templateId) ?? "?"})`,
    `period=${occurrence.periodStart}`,
    `candidates=${verdict.candidateDepartmentIds.map(deptLabel).join(",") || "-"}`,
    `proposed=${verdict.proposedDepartmentId == null ? "-" : deptLabel(verdict.proposedDepartmentId)}`,
    verdict.reason,
  ].join(" | ");
  if (verdict.kind === "definite" && verdict.sourceDepartmentId != null) {
    definite += 1;
    proposed.set(occurrence.id, verdict.sourceDepartmentId);
    if (definiteSamples.length < SAMPLE_LIMIT) definiteSamples.push(line);
    continue;
  }
  ambiguous += 1;
  if (ambiguousSamples.length < SAMPLE_LIMIT) ambiguousSamples.push(line);
}

const lines = [
  "گزارش backfill منبع دپارتمان (فقط خواندنی)",
  `کل occurrence: ${occurrenceRows.length}`,
  `از قبل منبع دارد: ${alreadySet}`,
  `قطعی: ${definite}`,
  `مبهم: ${ambiguous}`,
  "",
];
if (definiteSamples.length === 0) {
  lines.push("نمونه قطعی: هیچ");
} else {
  lines.push(`نمونه قطعی (حداکثر ${SAMPLE_LIMIT}):`);
  lines.push(...definiteSamples);
}
lines.push("");
if (ambiguousSamples.length === 0) {
  lines.push("نمونه مبهم: هیچ");
} else {
  lines.push(`نمونه مبهم (حداکثر ${SAMPLE_LIMIT}):`);
  lines.push(...ambiguousSamples);
}
lines.push("");
process.stdout.write(`${lines.join("\n")}\n`);

if (process.argv.includes("--apply")) {
  const expectedIds = Object.keys(CONFIRMED).map(Number).sort((a, b) => a - b);
  const actualIds = [...proposed.keys()].sort((a, b) => a - b);
  const sameIds =
    expectedIds.length === actualIds.length &&
    expectedIds.every((id, index) => id === actualIds[index]);
  const sameSources = sameIds && expectedIds.every((id) => proposed.get(id) === CONFIRMED[id]);
  if (!sameIds || !sameSources || ambiguous !== 0 || alreadySet !== 0) {
    process.stderr.write(
      "نوشتن لغو شد: نتیجه با نقشه تأییدشده یکی نیست یا ردیف مبهم/ازقبل‌پر وجود دارد.\n",
    );
    process.exit(1);
  }

  db.transaction((tx) => {
    for (const id of expectedIds) {
      const sourceDepartmentId = CONFIRMED[id]!;
      const updated = tx
        .update(taskOccurrences)
        .set({ sourceDepartmentId, updatedAt: new Date() })
        .where(eq(taskOccurrences.id, id))
        .run();
      if (updated.changes !== 1) {
        throw new Error(`ردیف ${id} به‌روز نشد`);
      }
    }
    const remaining = tx
      .select({ id: taskOccurrences.id })
      .from(taskOccurrences)
      .where(isNull(taskOccurrences.sourceDepartmentId))
      .all();
    if (remaining.length > 0) {
      throw new Error("هنوز occurrence بدون منبع مانده است");
    }
    tx.insert(auditLogs)
      .values({
        actorId: null,
        action: "occurrence.source_backfill",
        entity: "task_occurrence",
        entityId: null,
        meta: {
          rows: expectedIds.map((id) => ({
            id,
            sourceDepartmentId: CONFIRMED[id],
          })),
        },
      })
      .run();
  });
  process.stdout.write(`نوشته شد: ${expectedIds.length} ردیف در یک transaction.\n`);
}

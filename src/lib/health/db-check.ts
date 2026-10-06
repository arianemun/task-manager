import { and, asc, eq, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db, type Db } from "@/db";
import {
  auditLogs,
  settings,
  taskAssignments,
  taskOccurrences,
  taskTemplates,
  userDepartments,
  users,
} from "@/db/schema";
import {
  addGregorianDays,
  compareGDate,
  tehranDateFromMs,
  todayTehran,
  type GDate,
} from "@/lib/dates";
import { earliestEligibleStart } from "@/lib/recurrence";
import {
  DATA_HEALTH_LAST_RUN_KEY,
  LAST_OCCURRENCE_GENERATED_KEY,
  LAST_PERIOD_CLOSE_KEY,
} from "@/lib/settings/system-keys";
import { toFaDigits } from "@/lib/utils";

const SAMPLE_LIMIT = 10;
const STALE_MS = 2 * 24 * 60 * 60 * 1000;
const CLOSING = ["DONE", "DONE_LATE", "NOT_DONE"] as const;

export type HealthCheckId =
  | "foreign_close"
  | "peer_ref"
  | "peer_on_individual"
  | "stale_pending"
  | "done_without_time"
  | "missed_open"
  | "early_period"
  | "after_deactivation"
  | "generate_stale"
  | "backup_stale"
  | "close_stale"
  | "source_department";

export type HealthFinding = {
  id: HealthCheckId;
  title: string;
  count: number;
  sampleIds: number[];
  detail?: string;
  durationMs: number;
};

export type HealthReport = {
  ranAt: string;
  ok: boolean;
  elapsedMs: number;
  checks: HealthFinding[];
};

type CheckRunner = {
  id: HealthCheckId;
  title: string;
  run: (database: Db) => Omit<HealthFinding, "id" | "title" | "durationMs">;
};

function counted(
  database: Db,
  where: SQL | undefined,
): { count: number; sampleIds: number[] } {
  const countRow = database
    .select({ n: sql<number>`count(*)` })
    .from(taskOccurrences)
    .where(where)
    .get();
  const sample = database
    .select({ id: taskOccurrences.id })
    .from(taskOccurrences)
    .where(where)
    .orderBy(asc(taskOccurrences.id))
    .limit(SAMPLE_LIMIT)
    .all();
  return {
    count: Number(countRow?.n ?? 0),
    sampleIds: sample.map((row) => row.id),
  };
}

/**
 * بررسی ۱ — ایندکس task_occurrences_status_idx.
 * منطق قبلی scripts/report-copied-group-done.ts.
 */
function foreignClose(database: Db) {
  return counted(
    database,
    and(
      inArray(taskOccurrences.status, [...CLOSING]),
      isNotNull(taskOccurrences.completedByUserId),
      sql`${taskOccurrences.completedByUserId} != ${taskOccurrences.userId}`,
    ),
  );
}

/**
 * بررسی ۲ — status و PK ارجاع (task_occurrences_done_by_occ_idx / id).
 */
function peerRef(database: Db) {
  return counted(
    database,
    and(
      eq(taskOccurrences.status, "DONE_BY_PEER"),
      sql`(
        ${taskOccurrences.doneByOccurrenceId} IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM task_occurrences AS src
          WHERE src.id = ${taskOccurrences.doneByOccurrenceId}
        )
        OR EXISTS (
          SELECT 1 FROM task_occurrences AS src
          WHERE src.id = ${taskOccurrences.doneByOccurrenceId}
            AND (
              src.status NOT IN ('DONE', 'DONE_LATE')
              OR src.template_id != ${taskOccurrences.templateId}
              OR src.period_key != ${taskOccurrences.periodKey}
            )
        )
      )`,
    ),
  );
}

/** بررسی ۳ — status + task_templates PK. */
function peerOnIndividual(database: Db) {
  const where = and(
    eq(taskOccurrences.status, "DONE_BY_PEER"),
    eq(taskTemplates.completionMode, "INDIVIDUAL"),
  );
  const countRow = database
    .select({ n: sql<number>`count(*)` })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(where)
    .get();
  const sample = database
    .select({ id: taskOccurrences.id })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskOccurrences.templateId, taskTemplates.id))
    .where(where)
    .orderBy(asc(taskOccurrences.id))
    .limit(SAMPLE_LIMIT)
    .all();
  return {
    count: Number(countRow?.n ?? 0),
    sampleIds: sample.map((row) => row.id),
  };
}

/** بررسی ۴ — status و period_end (task_occurrences_period_end_idx). */
function stalePending(database: Db) {
  const yesterday = addGregorianDays(todayTehran(), -1);
  return counted(
    database,
    and(
      eq(taskOccurrences.status, "PENDING"),
      sql`${taskOccurrences.periodEnd} < ${yesterday}`,
    ),
  );
}

/** بررسی ۵ — task_occurrences_status_idx. */
function doneWithoutTime(database: Db) {
  return counted(
    database,
    and(
      inArray(taskOccurrences.status, ["DONE", "DONE_LATE"]),
      sql`${taskOccurrences.completedAt} IS NULL`,
    ),
  );
}

/** بررسی ۶ — status؛ دوره وقتی تمام شده که period_end قبل از امروز باشد. */
function missedOpen(database: Db) {
  const today = todayTehran();
  return counted(
    database,
    and(
      eq(taskOccurrences.status, "MISSED"),
      sql`${taskOccurrences.periodEnd} >= ${today}`,
    ),
  );
}

function rememberSample(sample: number[], id: number) {
  if (sample.length < SAMPLE_LIMIT) {
    sample.push(id);
    sample.sort((a, b) => a - b);
    return;
  }
  const last = sample[sample.length - 1]!;
  if (id < last) {
    sample[sample.length - 1] = id;
    sample.sort((a, b) => a - b);
  }
}

function msToTehranDate(ms: number, cache: Map<number, GDate>): GDate {
  const hit = cache.get(ms);
  if (hit) return hit;
  const date = tehranDateFromMs(ms);
  cache.set(ms, date);
  return date;
}

/**
 * بررسی ۷ — یک‌بار خواندن occurrence و assignment.
 * شروع مجاز همان earliestEligibleStart در generate است:
 * برای هر مسیر max(شروع کار، تاریخ assignment، hire_date، تاریخ پیوستن)
 * و بین مسیرهای مستقیم و دپارتمان، زودترین.
 */
function earlyPeriod(database: Db) {
  const templates = new Map(
    database
      .select({
        id: taskTemplates.id,
        startDate: taskTemplates.startDate,
      })
      .from(taskTemplates)
      .all()
      .map((row) => [row.id, row.startDate as GDate]),
  );
  const people = new Map(
    database
      .select({
        id: users.id,
        hireDate: users.hireDate,
        departmentId: users.departmentId,
        departmentJoinedAt: users.departmentJoinedAt,
      })
      .from(users)
      .all()
      .map((row) => [row.id, row]),
  );
  const assignments = database
    .select({
      templateId: taskAssignments.templateId,
      assigneeType: taskAssignments.assigneeType,
      userId: taskAssignments.userId,
      departmentId: taskAssignments.departmentId,
      createdAt: taskAssignments.createdAt,
    })
    .from(taskAssignments)
    .all();
  const membershipRows = database
    .select({
      userId: userDepartments.userId,
      departmentId: userDepartments.departmentId,
      joinedAt: userDepartments.joinedAt,
    })
    .from(userDepartments)
    .all();

  const userAssignMin = new Map<string, number>();
  const deptAssigns = new Map<
    number,
    Array<{ departmentId: number; createdMs: number }>
  >();
  for (const row of assignments) {
    const createdMs =
      row.createdAt instanceof Date
        ? row.createdAt.getTime()
        : Number(row.createdAt);
    if (row.assigneeType === "USER" && row.userId) {
      const key = `${row.templateId}:${row.userId}`;
      const prev = userAssignMin.get(key);
      if (prev == null || createdMs < prev) userAssignMin.set(key, createdMs);
    }
    if (row.assigneeType === "DEPARTMENT" && row.departmentId) {
      const list = deptAssigns.get(row.templateId) ?? [];
      list.push({ departmentId: row.departmentId, createdMs });
      deptAssigns.set(row.templateId, list);
    }
  }

  const memberships = new Map<number, Array<{ departmentId: number; joinedAt: GDate }>>();
  for (const row of membershipRows) {
    const list = memberships.get(row.userId) ?? [];
    list.push({
      departmentId: row.departmentId,
      joinedAt: row.joinedAt as GDate,
    });
    memberships.set(row.userId, list);
  }

  const occurrences = database
    .select({
      id: taskOccurrences.id,
      templateId: taskOccurrences.templateId,
      userId: taskOccurrences.userId,
      periodStart: taskOccurrences.periodStart,
    })
    .from(taskOccurrences)
    .all();

  const dates = new Map<number, GDate>();
  const sampleIds: number[] = [];
  let count = 0;

  for (const row of occurrences) {
    const templateStart = templates.get(row.templateId);
    const person = people.get(row.userId);
    if (!templateStart || !person) continue;

    const paths: Array<{
      templateStart: GDate;
      assignmentCreatedDate: GDate;
      hireDate?: GDate | null;
      departmentJoinedAt?: GDate | null;
    }> = [];

    const directMs = userAssignMin.get(`${row.templateId}:${row.userId}`);
    if (directMs != null) {
      paths.push({
        templateStart,
        assignmentCreatedDate: msToTehranDate(directMs, dates),
        hireDate: person.hireDate,
      });
    }

    const linked = memberships.get(row.userId);
    for (const assignment of deptAssigns.get(row.templateId) ?? []) {
      let joinedAt: GDate | null | undefined;
      if (linked && linked.length > 0) {
        joinedAt = linked.find(
          (item) => item.departmentId === assignment.departmentId,
        )?.joinedAt;
        if (!joinedAt) continue;
      } else if (person.departmentId === assignment.departmentId) {
        joinedAt = person.departmentJoinedAt;
      } else {
        continue;
      }
      paths.push({
        templateStart,
        assignmentCreatedDate: msToTehranDate(assignment.createdMs, dates),
        hireDate: person.hireDate,
        departmentJoinedAt: joinedAt,
      });
    }

    const eligible = paths.length
      ? earliestEligibleStart(paths)
      : templateStart;
    if (compareGDate(row.periodStart, eligible) < 0) {
      count += 1;
      rememberSample(sampleIds, row.id);
    }
  }

  return { count, sampleIds };
}

function timestampMs(value: Date | number | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : Number(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * بررسی ۸ — اول کاربران غیرفعال (جدول کوچک)، بعد occurrence با
 * task_occurrences_user_period_idx و audit با audit_logs_entity_idx.
 * تاریخ غیرفعال‌سازی: زودترین audit غیرفعال/حذف، وگرنه deleted_at، وگرنه updated_at.
 */
function afterDeactivation(database: Db) {
  const inactive = database
    .select({
      id: users.id,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(or(eq(users.isActive, false), isNotNull(users.deletedAt)))
    .all();
  if (inactive.length === 0) return { count: 0, sampleIds: [] as number[] };

  const audits = database
    .select({
      entityId: auditLogs.entityId,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entity, "user"),
        inArray(
          auditLogs.entityId,
          inactive.map((user) => String(user.id)),
        ),
        inArray(auditLogs.action, ["staff.deactivate", "staff.soft_delete"]),
      ),
    )
    .all();

  const earliestAudit = new Map<number, number>();
  for (const row of audits) {
    const userId = Number(row.entityId);
    const ms = timestampMs(row.createdAt);
    if (!Number.isInteger(userId) || ms == null) continue;
    const prev = earliestAudit.get(userId);
    if (prev == null || ms < prev) earliestAudit.set(userId, ms);
  }

  const cutoffByUser = new Map<number, number>();
  for (const user of inactive) {
    const cutoff =
      earliestAudit.get(user.id) ??
      timestampMs(user.deletedAt) ??
      (user.isActive ? null : timestampMs(user.updatedAt));
    if (cutoff != null) cutoffByUser.set(user.id, cutoff);
  }
  if (cutoffByUser.size === 0) return { count: 0, sampleIds: [] as number[] };

  const rows = database
    .select({
      id: taskOccurrences.id,
      userId: taskOccurrences.userId,
      createdAt: taskOccurrences.createdAt,
    })
    .from(taskOccurrences)
    .where(inArray(taskOccurrences.userId, [...cutoffByUser.keys()]))
    .orderBy(asc(taskOccurrences.id))
    .all();

  const sampleIds: number[] = [];
  let count = 0;
  for (const row of rows) {
    const cutoff = cutoffByUser.get(row.userId);
    const created = timestampMs(row.createdAt);
    if (cutoff == null || created == null || created <= cutoff) continue;
    count += 1;
    rememberSample(sampleIds, row.id);
  }
  return { count, sampleIds };
}

function dateSettingStale(
  database: Db,
  key: string,
  missingDetail: string,
) {
  const row = database
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  const today = todayTehran();
  const cutoff = addGregorianDays(today, -2);
  if (!row?.value || !/^\d{4}-\d{2}-\d{2}$/.test(row.value)) {
    return {
      count: 1,
      sampleIds: [] as number[],
      detail: missingDetail,
    };
  }
  if (compareGDate(row.value, cutoff) < 0) {
    return {
      count: 1,
      sampleIds: [] as number[],
      detail: `آخرین تاریخ: ${row.value}`,
    };
  }
  return { count: 0, sampleIds: [] as number[] };
}

/** بررسی ۹ — settings PK. ردیف occurrence ندارد. */
function generateStale(database: Db) {
  return dateSettingStale(
    database,
    LAST_OCCURRENCE_GENERATED_KEY,
    "last_occurrence_generated_date ثبت نشده",
  );
}

function resolveBackupDir(override?: string): string {
  const raw = override ?? process.env.BACKUP_DIR ?? "./backups";
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

/** بررسی ۱۰ — جدیدترین app_*.db. شناسه occurrence ندارد. */
function backupStale(backupDir?: string) {
  const dir = resolveBackupDir(backupDir);
  const today = todayTehran();
  const cutoff = addGregorianDays(today, -2);
  if (!fs.existsSync(dir)) {
    return {
      count: 1,
      sampleIds: [] as number[],
      detail: `پوشه بکاپ نیست: ${dir}`,
    };
  }
  const names = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith("app_") && name.endsWith(".db"));
  let newest: { name: string; mtimeMs: number } | null = null;
  for (const name of names) {
    const mtimeMs = fs.statSync(path.join(dir, name)).mtimeMs;
    if (!newest || mtimeMs > newest.mtimeMs) newest = { name, mtimeMs };
  }
  if (!newest) {
    return {
      count: 1,
      sampleIds: [] as number[],
      detail: "فایل بکاپ app_*.db پیدا نشد",
    };
  }
  const day = tehranDateFromMs(newest.mtimeMs);
  if (compareGDate(day, cutoff) < 0) {
    return {
      count: 1,
      sampleIds: [] as number[],
      detail: `آخرین بکاپ: ${newest.name} (${day})`,
    };
  }
  return { count: 0, sampleIds: [] as number[] };
}

/**
 * بررسی ۱۲ — منبع دپارتمان.
 * عضویت فعلی است: ردیف user_departments با joined_at <= period_start،
 * یا در نبود هر ردیف عضویت، ستون قدیمی users.department_id.
 * نبودن ردیف عضویت بعد از خروج از دپارتمان هم «عضو نبودن» حساب می‌شود.
 */
function sourceDepartment(database: Db) {
  return counted(
    database,
    sql`(
      ${taskOccurrences.sourceDepartmentId} IS NULL
      OR NOT (
        EXISTS (
          SELECT 1 FROM user_departments AS ud
          WHERE ud.user_id = ${taskOccurrences.userId}
            AND ud.department_id = ${taskOccurrences.sourceDepartmentId}
            AND ud.joined_at <= ${taskOccurrences.periodStart}
        )
        OR (
          NOT EXISTS (
            SELECT 1 FROM user_departments AS ud
            WHERE ud.user_id = ${taskOccurrences.userId}
          )
          AND EXISTS (
            SELECT 1 FROM users AS u
            WHERE u.id = ${taskOccurrences.userId}
              AND u.department_id = ${taskOccurrences.sourceDepartmentId}
              AND (
                u.department_joined_at IS NULL
                OR u.department_joined_at <= ${taskOccurrences.periodStart}
              )
          )
        )
      )
    )`,
  );
}

/** بررسی ۱۱ — settings PK. */
function closeStale(database: Db) {
  return dateSettingStale(
    database,
    LAST_PERIOD_CLOSE_KEY,
    "last_period_close_date ثبت نشده",
  );
}

const RUNNERS: CheckRunner[] = [
  {
    id: "foreign_close",
    title: "DONE، DONE_LATE یا NOT_DONE با completed_by شخص دیگر",
    run: foreignClose,
  },
  {
    id: "peer_ref",
    title: "DONE_BY_PEER بدون ارجاع معتبر به همان کار و دوره",
    run: peerRef,
  },
  {
    id: "peer_on_individual",
    title: "DONE_BY_PEER روی کار فردی",
    run: peerOnIndividual,
  },
  {
    id: "stale_pending",
    title: "PENDING با period_end قبل از دیروز",
    run: stalePending,
  },
  {
    id: "done_without_time",
    title: "DONE یا DONE_LATE بدون completed_at",
    run: doneWithoutTime,
  },
  {
    id: "missed_open",
    title: "MISSED در دوره‌ای که هنوز تمام نشده",
    run: missedOpen,
  },
  {
    id: "early_period",
    title: "period_start قبل از شروع مجاز کار",
    run: earlyPeriod,
  },
  {
    id: "after_deactivation",
    title: "occurrence بعد از غیرفعال‌سازی یا حذف کاربر",
    run: afterDeactivation,
  },
  {
    id: "generate_stale",
    title: "آخرین generate موفق قدیمی‌تر از ۲ روز",
    run: generateStale,
  },
  {
    id: "close_stale",
    title: "آخرین close-periods موفق قدیمی‌تر از ۲ روز",
    run: closeStale,
  },
  {
    id: "source_department",
    title:
      "occurrence بدون source_department_id یا با دپارتمانی که کاربر در period_start عضوش نبوده",
    run: sourceDepartment,
  },
];

/** فقط می‌خواند. هیچ ردیف کاری را عوض نمی‌کند. */
export function runHealthChecks(
  database: Db = db,
  options?: { backupDir?: string },
): HealthReport {
  const started = performance.now();
  const checks: HealthFinding[] = RUNNERS.map((runner) => {
    const t0 = performance.now();
    const found = runner.run(database);
    return {
      id: runner.id,
      title: runner.title,
      count: found.count,
      sampleIds: found.sampleIds,
      detail: found.detail,
      durationMs: Math.round(performance.now() - t0),
    };
  });
  const backupStarted = performance.now();
  const backup = backupStale(options?.backupDir);
  checks.push({
    id: "backup_stale",
    title: "آخرین فایل بکاپ قدیمی‌تر از ۲ روز",
    count: backup.count,
    sampleIds: backup.sampleIds,
    detail: backup.detail,
    durationMs: Math.round(performance.now() - backupStarted),
  });
  return {
    ranAt: new Date().toISOString(),
    ok: checks.every((check) => check.count === 0),
    elapsedMs: Math.round(performance.now() - started),
    checks,
  };
}

export function saveHealthReport(
  report: HealthReport,
  database: Db = db,
): void {
  const value = JSON.stringify(report);
  const existing = database
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, DATA_HEALTH_LAST_RUN_KEY))
    .get();
  if (existing) {
    database
      .update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, DATA_HEALTH_LAST_RUN_KEY))
      .run();
  } else {
    database
      .insert(settings)
      .values({ key: DATA_HEALTH_LAST_RUN_KEY, value })
      .run();
  }
}

export function loadLastHealthReport(database: Db = db): HealthReport | null {
  const row = database
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, DATA_HEALTH_LAST_RUN_KEY))
    .get();
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value) as HealthReport;
    if (!parsed || !Array.isArray(parsed.checks) || !parsed.ranAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** آخرین اجرای ثبت‌شده بیش از ۲ روز پیش است، یا هنوز اجرایی نیست. */
export function healthRunIsStale(
  report: { ranAt: string } | null,
  nowMs = Date.now(),
): boolean {
  if (!report?.ranAt) return true;
  const ran = new Date(report.ranAt).getTime();
  if (Number.isNaN(ran)) return true;
  return nowMs - ran > STALE_MS;
}

/** زرد: اجرا نشده یا کهنه. قرمز: آخرین اجرا حداقل یک مشکل دارد. */
export function dashboardHealthAlerts(
  report: HealthReport | null,
  nowMs = Date.now(),
): { yellow: boolean; red: boolean } {
  return {
    yellow: healthRunIsStale(report, nowMs),
    red: Boolean(report?.checks.some((check) => check.count > 0)),
  };
}

export function formatTehranDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatHealthReport(report: HealthReport): string {
  const lines = [
    "بررسی سلامت داده",
    `زمان: ${formatTehranDateTime(report.ranAt)} (تهران)`,
    `مدت: ${toFaDigits(report.elapsedMs)} میلی‌ثانیه`,
    `نتیجه: ${report.ok ? "سالم" : "مشکل دارد"}`,
    "",
  ];
  report.checks.forEach((check, index) => {
    lines.push(
      `${toFaDigits(index + 1)}. ${check.title} — ${toFaDigits(check.count)} (${toFaDigits(check.durationMs)} میلی‌ثانیه)`,
    );
    if (check.detail) lines.push(`   ${check.detail}`);
    if (check.sampleIds.length > 0) {
      lines.push(`   نمونه id: ${check.sampleIds.join(", ")}`);
    }
  });
  lines.push("");
  return lines.join("\n");
}

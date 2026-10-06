/**
 * یک‌بار: کار قالب ۱ (:D) را SHARED می‌کند و ردیف‌های کپی‌شدهٔ ۱، ۲ و ۷۴
 * را DONE_BY_PEER با ارجاع به occurrence کاربر ۱۶ در همان دوره می‌کند.
 * اگر قبلاً اعمال شده باشد کاری نمی‌کند.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { auditLogs, taskOccurrences, taskTemplates } from "../src/db/schema";

const TEMPLATE_ID = 1;
const PERIOD_KEY = "D:1405-07-14";
const COMPLETER_USER_ID = 16;
const PEER_IDS = [1, 2, 74];

const template = db
  .select()
  .from(taskTemplates)
  .where(eq(taskTemplates.id, TEMPLATE_ID))
  .get();
if (!template || template.title !== ":D") {
  throw new Error("قالب ۱ با عنوان :D پیدا نشد");
}

const source = db
  .select()
  .from(taskOccurrences)
  .where(
    and(
      eq(taskOccurrences.templateId, TEMPLATE_ID),
      eq(taskOccurrences.periodKey, PERIOD_KEY),
      eq(taskOccurrences.userId, COMPLETER_USER_ID),
    ),
  )
  .get();
if (!source) {
  throw new Error("occurrence کاربر ۱۶ در این دوره پیدا نشد");
}
if (source.status !== "DONE" && source.status !== "DONE_LATE") {
  throw new Error(`وضعیت occurrence مبدأ ${source.status} است`);
}

const peers = db
  .select()
  .from(taskOccurrences)
  .where(inArray(taskOccurrences.id, PEER_IDS))
  .all();
if (peers.length !== PEER_IDS.length) {
  throw new Error("هر سه ردیف ۱، ۲ و ۷۴ پیدا نشد");
}

const already = 
  template.completionMode === "SHARED" &&
  peers.every(
    (row) =>
      row.status === "DONE_BY_PEER" &&
      row.doneByOccurrenceId === source.id &&
      row.templateId === TEMPLATE_ID &&
      row.periodKey === PERIOD_KEY,
  );
if (already) {
  console.log("already-repaired");
  process.exit(0);
}

for (const row of peers) {
  if (row.templateId !== TEMPLATE_ID || row.periodKey !== PERIOD_KEY) {
    throw new Error(`ردیف ${row.id} متعلق به این دوره نیست`);
  }
  if (row.status !== "DONE" || row.completedByUserId !== COMPLETER_USER_ID) {
    throw new Error(`ردیف ${row.id} دیگر کپی DONE کاربر ۱۶ نیست`);
  }
}

const now = new Date();
db.transaction((tx) => {
  tx.update(taskTemplates)
    .set({ completionMode: "SHARED", updatedAt: now })
    .where(eq(taskTemplates.id, TEMPLATE_ID))
    .run();

  tx.update(taskOccurrences)
    .set({
      status: "DONE_BY_PEER",
      doneByOccurrenceId: source.id,
      completedByUserId: COMPLETER_USER_ID,
      completedAt: null,
      note: null,
      reasonCode: null,
      attachmentPath: null,
      updatedAt: now,
    })
    .where(inArray(taskOccurrences.id, PEER_IDS))
    .run();

  tx.insert(auditLogs)
    .values({
      actorId: null,
      action: "data.repair_shared_peers",
      entity: "task_template",
      entityId: String(TEMPLATE_ID),
      meta: {
        completionMode: "SHARED",
        periodKey: PERIOD_KEY,
        sourceOccurrenceId: source.id,
        completerUserId: COMPLETER_USER_ID,
        peerOccurrenceIds: PEER_IDS,
      },
    })
    .run();
});

console.log(
  `repaired template=${TEMPLATE_ID} source=${source.id} peers=${PEER_IDS.join(",")}`,
);

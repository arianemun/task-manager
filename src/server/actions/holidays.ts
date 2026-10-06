"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { holidays } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { isAuthError } from "@/lib/auth/errors";
import { requireUser } from "@/lib/auth/user";
import { fromJalaliString } from "@/lib/dates";
import type { ActionResult } from "./auth";

const gDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function createHolidaysAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireUser({ roles: ["ADMIN"] });
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "عنوان الزامی است" };

    // تاریخ‌ها می‌توانند جلالی (j:) یا میلادی باشند؛ چندتایی با کاما
    const raw = String(formData.get("dates") ?? "");
    const parts = raw
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return { ok: false, error: "حداقل یک تاریخ انتخاب کنید" };
    }

    const gDates: string[] = [];
    for (const p of parts) {
      if (p.startsWith("j:")) {
        gDates.push(fromJalaliString(p.slice(2)));
      } else {
        const parsed = gDate.safeParse(p);
        if (!parsed.success) {
          return { ok: false, error: `تاریخ نامعتبر: ${p}` };
        }
        gDates.push(parsed.data);
      }
    }

    let created = 0;
    for (const date of gDates) {
      const exists = db
        .select()
        .from(holidays)
        .where(eq(holidays.date, date))
        .get();
      if (exists) continue;
      db.insert(holidays).values({ date, title }).run();
      created += 1;
    }

    writeAuditLog({
      actorId: actor.id,
      action: "holiday.create",
      entity: "holiday",
      meta: { title, dates: gDates, created },
    });

    revalidatePath("/admin/holidays");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deleteHolidayAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireUser({ roles: ["ADMIN"] });
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return { ok: false, error: "شناسه نامعتبر" };

    db.delete(holidays).where(eq(holidays.id, id)).run();
    writeAuditLog({
      actorId: actor.id,
      action: "holiday.delete",
      entity: "holiday",
      entityId: id,
    });
    revalidatePath("/admin/holidays");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

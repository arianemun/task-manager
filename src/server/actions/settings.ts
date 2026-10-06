"use server";

import { revalidatePath } from "next/cache";
import { isAuthError } from "@/lib/auth/errors";
import { requireUser } from "@/lib/auth/user";
import {
  getNotDoneReasons,
  setNotDoneReasons,
  type NotDoneReason,
} from "@/lib/settings/not-done-reasons";
import { writeAuditLog } from "@/lib/audit";
import type { ActionResult } from "./auth";

export async function saveNotDoneReasonsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireUser({ roles: ["ADMIN"] });
    const raw = String(formData.get("reasonsJson") || "[]");
    let parsed: NotDoneReason[];
    try {
      parsed = JSON.parse(raw) as NotDoneReason[];
    } catch {
      return { ok: false, error: "JSON نامعتبر" };
    }
    const cleaned = parsed
      .map((r) => ({
        code: String(r.code || "")
          .trim()
          .replace(/\s+/g, "_"),
        label: String(r.label || "").trim(),
      }))
      .filter((r) => r.code && r.label);
    if (cleaned.length === 0) {
      return { ok: false, error: "حداقل یک دلیل لازم است" };
    }
    setNotDoneReasons(cleaned);
    writeAuditLog({
      actorId: actor.id,
      action: "settings.not_done_reasons",
      entity: "settings",
      entityId: "not_done_reasons",
      meta: { count: cleaned.length },
    });
    revalidatePath("/admin/settings");
    revalidatePath("/me");
    return { ok: true };
  } catch (e) {
    if (isAuthError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function loadNotDoneReasonsAction(): Promise<NotDoneReason[]> {
  await requireUser({ roles: ["STAFF", "ADMIN", "MANAGER"] });
  return getNotDoneReasons();
}

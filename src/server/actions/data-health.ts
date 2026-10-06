"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { runHealthChecks, saveHealthReport } from "@/lib/health/db-check";

export async function rerunDataHealthCheckAction(): Promise<void> {
  await requireUser({ roles: ["ADMIN"] });
  const report = runHealthChecks();
  saveHealthReport(report);
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
}

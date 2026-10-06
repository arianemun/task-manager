import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export function writeAuditLog(input: {
  actorId: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  meta?: Record<string, unknown>;
}): void {
  db.insert(auditLogs)
    .values({
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId:
        input.entityId === undefined || input.entityId === null
          ? null
          : String(input.entityId),
      meta: input.meta ?? null,
    })
    .run();
}

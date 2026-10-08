import { z } from "zod";
import type { NotificationPriority, NotificationType } from "@/db/schema";

export type NotificationItem = {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  priority: NotificationPriority;
  readAt: number | null;
  createdAt: number;
};

export const socketNotificationSchema = z.object({
  userId: z.number().int().positive(),
  notification: z.object({
    id: z.number().int().positive(),
    type: z.string().min(1).max(64),
    title: z.string().max(200),
    body: z.string().max(180),
    url: z.string().max(300).nullable(),
    priority: z.enum(["LOW", "NORMAL", "HIGH"]),
    createdAt: z.number().int(),
  }),
});

export type SocketNotification = z.infer<typeof socketNotificationSchema>["notification"];

import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().min(1).default("file:./data/app.db"),
    SESSION_SECRET: z.string().min(1),
    CRON_SECRET: z.string().min(1),
    ADMIN_INITIAL_PASSWORD: z.string().min(8).optional(),
    UPLOAD_DIR: z.string().min(1).default("./uploads"),
    BACKUP_DIR: z.string().min(1).default("./backups"),
    TZ: z.string().default("Asia/Tehran"),
    COOKIE_SECURE: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (data.SESSION_SECRET.length < 32) {
        ctx.addIssue({
          code: "custom",
          path: ["SESSION_SECRET"],
          message:
            "SESSION_SECRET در production حداقل ۳۲ کاراکتر باشد",
        });
      }
      if (
        /change-me|secret|default|password/i.test(data.SESSION_SECRET) ||
        data.SESSION_SECRET === "change-me-to-a-long-random-string"
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["SESSION_SECRET"],
          message: "SESSION_SECRET پیش‌فرض در production مجاز نیست",
        });
      }
      if (data.CRON_SECRET.length < 16) {
        ctx.addIssue({
          code: "custom",
          path: ["CRON_SECRET"],
          message: "CRON_SECRET در production حداقل ۱۶ کاراکتر باشد",
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`پیکربندی env نامعتبر: ${msg}`);
  }
  cached = parsed.data;
  return cached;
}

/** برای تست — فقط در vitest */
export function resetEnvCache() {
  cached = null;
}

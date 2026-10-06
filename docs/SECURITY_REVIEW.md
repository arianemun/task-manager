# بازبینی امنیتی — فاز ۸

تاریخ بازبینی: ۱۴۰۴ (همگام با نهایی‌سازی استقرار)

## خلاصه

| حوزه | وضعیت |
|---|---|
| SQL injection / parameterized | بدون `sql.raw`؛ مقادیر کاربر با placeholderهای Drizzle |
| Sort / فیلتر | whitelist در گزارش‌ها و audit |
| Path traversal آپلود/فایل | نام تصادفی؛ `resolveUploadPath` + بررسی ریشه |
| هدرهای امنیتی | CSP self، X-Frame-Options DENY، nosniff، Referrer-Policy |
| AuthZ روی Actions / Routes | فهرست کامل پایین |
| env با zod | `src/lib/env.ts` + `instrumentation.ts`؛ SESSION_SECRET کوتاه/پیش‌فرض در production خطا |

---

## ۱. SQL و ورودی کاربر

- هیچ فراخوانی `sql.raw` در `src/` وجود ندارد.
- شرط‌های پویا با `eq` / `and` / `sql\`...\${value}\`` ساخته می‌شوند (مقدار bind می‌شود).
- فیلتر گزارش (`lib/reports/filters.ts`):
  - `range`، `granularity`، `staffSort`، `recurrenceType`، `priority` از whitelist
  - شناسه‌ها فقط عدد صحیح مثبت
  - `q` حداکثر ۲۰۰ کاراکتر
- لاگ فعالیت: `action` فقط از `AUDIT_ACTION_WHITELIST`

## ۲. فایل‌ها و آپلود

- آواتار/پیوست با `randomBytes` نام‌گذاری می‌شوند؛ پسوند از signature بایت‌ها.
- `resolveUploadPath`: حذف `..`، `\0`، و اطمینان از قرارگیری زیر `UPLOAD_DIR`.
- `GET /api/files/[...path]`: احراز هویت + کنترل دسترسی (مالک / مدیر دپارتمان / ADMIN) + رد مسیر خارج از ریشه.

## ۳. هدرها (`next.config.ts`)

- `Content-Security-Policy`: `default-src 'self'`؛ بدون CDN خارجی (برای Next: `unsafe-inline`/`unsafe-eval` روی script به‌خاطر runtime لازم است)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: دوربین/میکروفون/موقعیت خاموش

## ۴. متغیرهای محیطی

فایل: `src/lib/env.ts` — هنگام استارت Node (`instrumentation`) اعتبارسنجی می‌شود.

در **production**:

- `SESSION_SECRET` ≥ ۳۲ کاراکتر و بدون الگوی پیش‌فرض (`change-me` و مشابه)
- `CRON_SECRET` ≥ ۱۶ کاراکتر

نمونه: `.env.example`

## ۵. فهرست AuthZ — Route Handlers

| مسیر | احراز / مجوز |
|---|---|
| `GET /api/health` | عمومی؛ فقط وضعیت DB (بدون داده حساس) |
| `GET /api/files/[...path]` | `requireUser` (+ allowMustChangePassword)؛ scope فایل |
| `GET /api/export/reports` | `requireUser` ADMIN/MANAGER + `reports.export` برای مدیر |
| `POST /api/cron/generate` | `Authorization: Bearer CRON_SECRET` |
| `POST /api/cron/close-periods` | `Authorization: Bearer CRON_SECRET` |
| `POST /api/internal/preview-occurrences` | `requirePermission("tasks.create")` |

## ۶. فهرست AuthZ — Server Actions

| Action | فایل | محافظت |
|---|---|---|
| `loginAction` | `auth.ts` | عمومی + rate limit |
| `logoutAction` | `auth.ts` | پاک کردن کوکی |
| `changePasswordAction` | `auth.ts` | `requireUser(allowMustChangePassword)` |
| `adminResetPasswordInternal` | `auth.ts` | ADMIN/MANAGER (داخلی) |
| `setUserActiveInternal` | `auth.ts` | ADMIN/MANAGER (داخلی) |
| `createStaffAction` | `staff.ts` | `staff.manage` |
| `updateStaffAction` | `staff.ts` | `staff.manage` |
| `setStaffPermissionsAction` | `staff.ts` | ADMIN |
| `softDeleteStaffAction` | `staff.ts` | `staff.manage` |
| `setStaffActiveAction` | `staff.ts` | `staff.manage` |
| `resetStaffPasswordAction` | `staff.ts` | `staff.manage` |
| `uploadStaffAvatarAction` | `staff.ts` | خود کاربر یا `staff.manage` |
| `listActiveStaffIdsInDepartment` | `staff.ts` | از مسیرهای دارای auth فراخوانی می‌شود |
| `createDepartmentAction` / `update` | `departments.ts` | `staff.manage` |
| `deleteDepartmentAction` | `departments.ts` | ADMIN |
| `createStaffNoteAction` / `delete` | `notes.ts` | `staff.manage` |
| `createTaskAction` / `update` / `archive` / `activate` | `tasks.ts` | `tasks.create` |
| `countUniqueAssigneesAction` | `tasks.ts` | ADMIN/MANAGER |
| `updateOccurrenceStatusAction` | `board.ts` | `tasks.assign` + scope |
| `createStaffLeaveAction` | `board.ts` | `tasks.assign` + scope |
| `submitOccurrenceAction` | `occurrences.ts` | `requireUser`؛ فقط مالک occurrence |
| `createAnnouncementAction` / `delete` / stats | `announcements.ts` | `announcements.manage` |
| `markAnnouncementReadAction` | `announcements.ts` | `requireUser` |
| `createHolidaysAction` / `deleteHolidayAction` | `holidays.ts` | ADMIN |
| `saveNotDoneReasonsAction` | `settings.ts` | ADMIN |
| `loadNotDoneReasonsAction` | `settings.ts` | هر کاربر واردشده |

## ۷. صفحات (layout / page)

| مسیر | نقش |
|---|---|
| `/admin/*` (layout) | ADMIN, MANAGER |
| `/admin/audit` | فقط ADMIN |
| `/admin/settings`, `/admin/holidays` | فقط ADMIN |
| `/admin/reports` | ADMIN, MANAGER (+ مجوز گزارش در صورت نیاز) |
| `/me/*` | STAFF, ADMIN, MANAGER |
| `/login`, `/change-password` | عمومی / کاربر با mustChange |

Middleware فقط مسیر را هدایت می‌کند؛ منبع حقیقت مجوز `requireUser` از DB است (`sessionVersion` + نقش).

## ۸. توصیه‌های عملیاتی

1. پس از اولین استقرار رمز `admin` را عوض کنید (`mustChangePassword` اجباری است).
2. `COOKIE_SECURE=true` پشت HTTPS.
3. `DATABASE_URL`، `UPLOAD_DIR`، `BACKUP_DIR` خارج از پوشه build.
4. Cron فقط با `CRON_SECRET` قوی؛ endpointها را در reverse proxy در صورت امکان محدود کنید.
5. بکاپ روزانه با `npm run db:backup` و تست دوره‌ای `db:restore`.

## ۹. موارد آگاهانه / محدودیت

- CSP برای App Router Next به `unsafe-inline`/`unsafe-eval` روی script نیاز دارد؛ منبع خارجی اضافه نشده.
- SQLite تک‌فایل؛ دسترسی فایل‌سیستم سرور = دسترسی کامل به داده — سخت‌سازی OS و پرمیشن‌ها ضروری است.

# چک‌لیست قبل از راه‌اندازی production

قبل از باز کردن سامانه برای کاربران، همه موارد را تیک بزنید.

## امنیت و env

- [ ] فایل `.env` از `.env.example` ساخته شده و روی سرور است (نه داخل git)
- [ ] `NODE_ENV=production`
- [ ] `SESSION_SECRET` تصادفی و حداقل ۳۲ کاراکتر (نه مقدار نمونه)
- [ ] `CRON_SECRET` تصادفی و قوی
- [ ] `ADMIN_INITIAL_PASSWORD` قوی؛ پس از اولین ورود عوض شود
- [ ] `COOKIE_SECURE=true` (HTTPS فعال باشد)
- [ ] `TZ=Asia/Tehran`
- [ ] `DATABASE_URL` خارج از پوشه `.next` (مثلاً `/var/task-manager/data/app.db`)
- [ ] `UPLOAD_DIR` و `BACKUP_DIR` خارج از build

## دیتابیس و seed

- [ ] `npm run db:migrate` روی سرور اجرا شده
- [ ] `npm run db:seed` فقط admin ساخته (کاربران نمونه development نباشند)
- [ ] ورود با admin و **تغییر رمز اجباری** انجام شده
- [ ] رمز پیش‌فرض دیگر معتبر نیست

## بیلد و اجرا

- [ ] `npm ci` و `npm run build` بدون خطا
- [ ] کنار `server.js` پوشه‌های `public` و `.next/static` وجود دارند (اسکریپت `copy-standalone`)
- [ ] PM2 با `ecosystem.config.js` و `TZ=Asia/Tehran`
- [ ] `pm2 startup` و `pm2 save` تنظیم شده
- [ ] `GET /api/health` برابر `{ ok: true, db: "up" }`

## Reverse Proxy / SSL (aaPanel)

- [ ] دامنه به پورت اپ (مثلاً 3000) پروکسی شده
- [ ] گواهی SSL نصب و تمدید خودکار فعال
- [ ] هدرهای امنیتی از اپ می‌رسند (CSP، X-Frame-Options)

## Cron

- [ ] Cron تولید: هر روز **۰۰:۰۵** → `npm run cron:generate` یا POST `/api/cron/generate`
- [ ] Cron بستن دوره: هر روز **۲۳:۵۵** → `npm run cron:close` یا POST `/api/cron/close-periods`
- [ ] هر دو با `CRON_SECRET` تست دستی شده‌اند
- [ ] Cron بکاپ روزانه → `npm run db:backup`

## بکاپ و بازیابی

- [ ] یک بکاپ موفق در `BACKUP_DIR` دیده می‌شود (`app_*.db` + در صورت وجود `uploads_*.zip`)
- [ ] روی محیط آزمایشی `npm run db:restore -- <فایل>` تست شده
- [ ] نگهداری ۱۴ نسخه آخر تأیید شده

## تست عملکردی کوتاه

- [ ] مدیر: ایجاد پرسنل، کار روزانه، تخصیص
- [ ] پرسنل: انجام کار امروز، مشاهده گزارش شخصی
- [ ] گزارش مدیر برای همان نفر/بازه با `/me/report` هم‌خوان است
- [ ] خروجی Excel اعداد را به‌صورت عدد نشان می‌دهد
- [ ] صفحه `/admin/audit` فقط برای ADMIN باز می‌شود

## پس از آپدیت نسخه

- [ ] `git pull` → `npm ci` → `npm run db:migrate` → `npm run build` → `pm2 reload task-manager`
- [ ] health و ورود مجدد سالم است

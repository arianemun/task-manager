# سامانه مدیریت پرسنل و کارهای دوره‌ای

اپلیکیشن Next.js ۱۵ (App Router) + SQLite/Drizzle برای پیگیری کارهای دوره‌ای پرسنل، با تقویم شمسی و رابط RTL.

مستند طراحی: [`PROJECT.md`](./PROJECT.md)  
بازبینی امنیت: [`docs/SECURITY_REVIEW.md`](./docs/SECURITY_REVIEW.md)  
چک‌لیست استقرار: [`docs/DEPLOY_CHECKLIST.md`](./docs/DEPLOY_CHECKLIST.md)  
راهنمای مدیر: [`docs/ADMIN_GUIDE.md`](./docs/ADMIN_GUIDE.md)

---

## پیش‌نیازها

| مورد | توضیح |
|---|---|
| Node.js | نسخه ۲۰ یا بالاتر |
| npm | همراه Node |
| سیستم‌عامل | ویندوز ۱۰/۱۱ یا Ubuntu (aaPanel) |
| بیلد native | برای `better-sqlite3` روی لینوکس: `build-essential` و `python3` |

---

## نصب روی ویندوز (CMD)

```bat
cd /d D:\Github\task-manager
copy .env.example .env
:: SESSION_SECRET و CRON_SECRET را در .env ویرایش کنید

npm install
npm run db:migrate
npm run db:seed

npm run dev
```

مرورگر: `http://localhost:3000`  
حساب پیش‌فرض توسعه: `admin` / مقدار `ADMIN_INITIAL_PASSWORD` (پیش‌فرض `Admin@123456`) — تغییر رمز در اولین ورود.

دستورات مفید:

```bat
npm test
npm run lint
npm run build
npm start
npm run db:seed:large
npm run bench:reports
npm run db:backup
npm run db:restore -- backups\app_XXXX.db
```

---

## نصب روی Ubuntu با aaPanel (قدم‌به‌قدم)

### ۱) وابستگی‌های native

```bash
sudo apt update
sudo apt install -y build-essential python3 git
```

Node 20 را از پنل aaPanel یا NodeSource نصب کنید.

### ۲) کلون و مسیر دادهٔ پایدار

```bash
sudo mkdir -p /var/task-manager/{data,uploads,backups}
sudo chown -R $USER:$USER /var/task-manager

cd /www/wwwroot   # یا مسیر دلخواه
git clone <REPO_URL> task-manager
cd task-manager
cp .env.example .env
```

نمونه مقادیر production در `.env`:

```env
NODE_ENV=production
DATABASE_URL=file:/var/task-manager/data/app.db
UPLOAD_DIR=/var/task-manager/uploads
BACKUP_DIR=/var/task-manager/backups
SESSION_SECRET=<حداقل-۳۲-کاراکتر-تصادفی>
CRON_SECRET=<رشته-تصادفی-قوی>
ADMIN_INITIAL_PASSWORD=<رمز-قوی>
COOKIE_SECURE=true
TZ=Asia/Tehran
```

> مسیر DB و آپلود/بکاپ را **خارج از** `.next` نگه دارید تا با دیپلوی بعدی پاک نشوند.

### ۳) نصب، migrate، seed، build

```bash
npm ci
npm run db:migrate
npm run db:seed          # در production فقط admin
npm run build            # next build + کپی public و .next/static به standalone
```

### ۴) PM2

```bash
npm i -g pm2
# از ریشه پروژه — cwd در ecosystem به .next/standalone اشاره می‌کند
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# دستور چاپ‌شده توسط pm2 startup را با sudo اجرا کنید
```

متغیرهای env را یا در `.env` ریشه (و لود توسط اپ) یا در بخش `env`ی `ecosystem.config.js` بگذارید. `TZ=Asia/Tehran` ضروری است.

اجرای مستقیم standalone:

```bash
cd .next/standalone
NODE_ENV=production node server.js
```

### ۵) Reverse Proxy و SSL در aaPanel

1. **Website** → Add site → دامنه را اضافه کنید.
2. در تنظیمات سایت → **Reverse Proxy**:
   - Target: `http://127.0.0.1:3000`
   - Send domain / WebSocket در صورت نیاز فعال
3. **SSL** → Let's Encrypt → Apply → Force HTTPS.
4. پس از اعمال، `/api/health` را از دامنه عمومی تست کنید.

### ۶) Cron در aaPanel

در **Cron** چهار کار زمان‌بندی کنید (منطقه زمانی سرور = تهران یا با `TZ=Asia/Tehran`):

| زمان | فرمان |
|---|---|
| `05 0 * * *` | `cd /path/to/task-manager && /usr/bin/npm run cron:generate` |
| `55 23 * * *` | `cd /path/to/task-manager && /usr/bin/npm run cron:close` |
| `15 2 * * *` | `cd /path/to/task-manager && /usr/bin/npm run db:backup` |
| `25 2 * * *` | `cd /path/to/task-manager && /usr/bin/npm run db:check >> /path/to/task-manager/logs/db-check-$(date +\%F).log 2>&1` |

`db:check` بعد از بکاپ روزانه اجرا می‌شود. فقط می‌خواند و ردیف کاری را اصلاح نمی‌کند؛ خلاصهٔ آخرین اجرا در `settings` ذخیره می‌شود. اگر مشکلی باشد کد خروج ۱ است و خروجی به لاگ همان روز اضافه می‌شود (`>>`).

نمونهٔ فرمان در aaPanel (فیلد Script؛ زمان‌بندی جدا: هر روز ۰۲:۲۵):

```bash
cd /www/wwwroot/task-manager && /www/server/nodejs/v24.12.0/bin/npm run db:check >> /www/server/nodejs/vhost/logs/db-check-$(date +%F).log 2>&1
```

یا HTTP (با هدر):

```bash
curl -X POST https://YOUR_HOST/api/cron/generate \
  -H "Authorization: Bearer $CRON_SECRET"
curl -X POST https://YOUR_HOST/api/cron/close-periods \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## بکاپ و بازیابی

بکاپ از **API `.backup()`** کتابخانه better-sqlite3 استفاده می‌کند (نه کپی خام فایل، به‌خاطر WAL):

```bash
npm run db:backup
```

- خروجی: `BACKUP_DIR/app_<تاریخ‌شمسی>_<timestamp>.db`
- zip پوشه آپلودها: `uploads_<...>.zip`
- نگهداری خودکار **۱۴** نسخه آخر

بازیابی:

```bash
# توقف اپ (pm2 stop task-manager) توصیه می‌شود
npm run db:restore -- /var/task-manager/backups/app_14040101_123.db
npm run db:migrate
pm2 reload task-manager
```

در صورت نیاز zip آپلودها را دستی روی `UPLOAD_DIR` باز کنید.

---

## روال آپدیت نسخه جدید

```bash
cd /path/to/task-manager
git pull
npm ci
npm run db:migrate      # جدا از build — اجباری در production
npm run build
pm2 reload task-manager
curl -s https://YOUR_HOST/api/health
```

seed را در آپدیت عادی دوباره اجرا نکنید مگر نیاز به ایجاد admin از دست‌رفته باشد.

---

## اسکریپت‌های npm مهم

| دستور | کاربرد |
|---|---|
| `npm run dev` | توسعه |
| `npm run build` | بیلد standalone + کپی static/public |
| `npm start` | اجرای `next start` |
| `npm run db:migrate` | اعمال migration |
| `npm run db:seed` | seed (prod: فقط admin) |
| `npm run db:seed:large` | داده حجیم برای بنچمارک |
| `npm run bench:reports` | زمان اندازه‌گیری‌شده کوئری‌های گزارش → `docs/BENCH_REPORTS.md` |
| `npm run db:check` | بررسی فقط‌خواندنی سلامت داده؛ خروج ۱ اگر مشکلی باشد |
| `npm run db:backup` / `db:restore` | بکاپ / بازیابی |
| `npm run cron:generate` / `cron:close` | کارهای زمان‌بندی |
| `npm test` / `lint` | تست و لینت |

---

## PWA

- `manifest.webmanifest` فارسی، آیکن ۱۹۲/۵۱۲، theme color
- Service Worker فقط فونت، آیکن و `_next/static` را کش می‌کند
- صفحات لاگین‌شده، API و Server Action کش نمی‌شوند
- آفلاین: پیام «اتصال برقرار نیست»

---

## عیب‌یابی رایج

| مشکل | راه‌حل |
|---|---|
| CSS/فونت در production نیست | `npm run build` را دوباره بزنید؛ وجود `.next/standalone/public` و `.next/standalone/.next/static` را چک کنید |
| خطای SESSION_SECRET هنگام استارت | secret را طولانی و غیرپیش‌فرض کنید |
| `better-sqlite3` بیلد نمی‌شود | `build-essential` و `python3` نصب شود؛ سپس `npm rebuild better-sqlite3` |
| Cron کار نمی‌کند | مسیر `npm`، `cwd` پروژه و `CRON_SECRET` را بررسی کنید |
| لاگین بعد از دیپلوی قطع می‌شود | `SESSION_SECRET` را عوض نکرده باشید؛ کوکی Secure فقط روی HTTPS |
| DB پاک شده بعد از دیپلوی | `DATABASE_URL` را خارج از پوشه build بگذارید |
| قفل فایل روی ویندوز (EBUSY) | اپ را ببندید؛ در صورت نیاز `npm run db:reset` فقط در توسعه |

سلامت:

```bash
curl http://127.0.0.1:3000/api/health
```

---

## توسعه و تست

```bash
npm test
npm run lint
npm run build
```

بنچمارک گزارش پس از داده بزرگ:

```bash
npm run db:seed:large
npm run bench:reports
```

نتیجه در [`docs/BENCH_REPORTS.md`](./docs/BENCH_REPORTS.md).

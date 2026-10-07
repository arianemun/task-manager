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

گفتگوی زنده یک پروسهٔ جداست (`task-manager-realtime` در همان فایل PM2). حالت اجرا `fork` و یک instance است. حافظهٔ Socket.IO داخل همین پروسه می‌ماند؛ اگر بعداً چند instance شود باید adapter جدا (مثلاً Redis) اضافه شود. Web Push در این مرحله نیست.

nginx باید `/socket.io/` را به پورت داخلی realtime (پیش‌فرض ۳۲۳۱) بفرستد. برای ویدیوی چت، `client_max_body_size` حداقل ۱۱۰ مگابایت باشد و `location /api/files/` هدر `Range` را به Next برساند و `proxy_buffering` آن خاموش باشد:

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:3231;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
}
```

هر دو پروسه همان فایل SQLite را با WAL و `busy_timeout` حداقل ۵ ثانیه باز می‌کنند. `INTERNAL_SECRET` را در `.env` بگذارید تا Next بتواند سوکت کاربر را بعد از غیرفعال‌سازی یا ریست رمز قطع کند. `APP_ORIGIN` مبدأ مجاز مرورگر است. اتصال مرورگر به همان میزبان است؛ `connect-src 'self'` شامل `wss` همان میزبان می‌شود.

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

اسکریپت‌ها مسیر پروژه را از محل خودشان پیدا می‌کنند و `node` را در زمان اجرا حل می‌کنند: اول `NODE_BIN` در `.cron.env`، بعد `node` در `PATH`، بعد جدیدترین `/www/server/nodejs/*/bin/node`. `npm` صدا زده نمی‌شود. هر کار با `flock` از اجرای هم‌زمان جلوگیری می‌کند و لاگ را در `LOG_DIR` (پیش‌فرض `logs/` داخل پروژه) با تاریخ و زمان تهران می‌نویسد. لاگ‌های `*.log` قدیمی‌تر از `LOG_RETENTION_DAYS` (پیش‌فرض ۳۰ روز) پاک می‌شوند.

تنظیم اختیاری:

```bash
cp .cron.env.example .cron.env
```

در aaPanel برای هر کار فقط همین یک خط را در فیلد Script بگذارید (زمان‌بندی جداگانه است):

```bash
bash /www/wwwroot/task-manager/scripts/cron/generate.sh
bash /www/wwwroot/task-manager/scripts/cron/close-periods.sh
bash /www/wwwroot/task-manager/scripts/cron/backup.sh
bash /www/wwwroot/task-manager/scripts/cron/db-check.sh
```

زمان‌بندی به وقت تهران:

| کار | زمان | خط |
|---|---|---|
| generate | ۰۰:۰۵ | `bash /www/wwwroot/task-manager/scripts/cron/generate.sh` |
| close-periods | ۰۰:۱۵ | `bash /www/wwwroot/task-manager/scripts/cron/close-periods.sh` |
| backup | ۰۲:۰۰ | `bash /www/wwwroot/task-manager/scripts/cron/backup.sh` |
| db-check | ۰۲:۲۵ | `bash /www/wwwroot/task-manager/scripts/cron/db-check.sh` |

نصب یا به‌روزرسانی همین چهار خط در crontab کاربر `www`، داخل بلوک `# BEGIN task-manager` تا `# END task-manager`:

```bash
sudo bash /www/wwwroot/task-manager/scripts/cron/install.sh
crontab -u www -l
```

`close-periods` ساعت ۰۰:۱۵ است تا کارهای دیروز کمی بعد از نیمه‌شب بسته شوند. قفل پاسخ پرسنل به این ساعت وابسته نیست: بعد از `period_end` ثبت مسدود است، حتی اگر وضعیت هنوز `PENDING` باشد و Cron اجرا نشده باشد. `due_at` فقط `DONE` را از `DONE_LATE` جدا می‌کند و تا پایان همان دوره ثبت را باز می‌گذارد.

ساعت‌های بالا وقتی درست‌اند که timezone سیستم `Asia/Tehran` باشد. aaPanel همان ساعت سیستم را برای Cron استفاده می‌کند. بررسی:

```bash
timedatectl
```

اگر `Time zone` تهران نیست:

```bash
sudo timedatectl set-timezone Asia/Tehran
```

تهران نسبت به UTC همیشه `+03:30` است و ساعت تابستانی ندارد. اگر سرور روی UTC بماند، همین کارها را این‌طور زمان‌بندی کنید:

| کار تهران | معادل UTC |
|---|---|
| ۰۰:۰۵ generate | ۲۰:۳۵ روز قبل |
| ۰۰:۱۵ close-periods | ۲۰:۴۵ روز قبل |
| ۰۲:۰۰ backup | ۲۲:۳۰ روز قبل |
| ۰۲:۲۵ db-check | ۲۲:۵۵ روز قبل |

مهر زمان داخل لاگ‌ها با `TZ=Asia/Tehran` نوشته می‌شود، حتی اگر ساعت Cron روی UTC باشد.

`db:check` فقط می‌خواند و ردیف کاری را اصلاح نمی‌کند. خلاصهٔ آخرین اجرا در `settings` می‌ماند. اگر مشکلی باشد کد خروج ۱ است.

جایگزین HTTP (به اسکریپت‌های بالا ترجیح داده نمی‌شود):

```bash
curl -X POST https://YOUR_HOST/api/cron/generate \
  -H "Authorization: Bearer $CRON_SECRET"
curl -X POST https://YOUR_HOST/api/cron/close-periods \
  -H "Authorization: Bearer $CRON_SECRET"
```

#### عیب‌یابی Cron

اگر در داشبورد مدیر Alert زرد «بررسی سلامت داده اجرا نشده» دیده شد:

1. لاگ همان روز را در `LOG_DIR` ببینید. پیش‌فرض `logs/db-check-YYYY-MM-DD.log` داخل پروژه است. اگر `LOG_DIR` در `.cron.env` عوض شده، همان مسیر را باز کنید.
2. خط `node:` ابتدای لاگ را چک کنید. اگر فایلی نیست یا لاگ با «node پیدا نشد» تمام شده، `NODE_BIN` را در `.cron.env` روی فایل اجرایی node همان سرور بگذارید.
3. اگر لاگ اصلاً ساخته نشده، در aaPanel ببینید خط Script همان `bash .../scripts/cron/db-check.sh` است و زمان‌بندی فعال است.

#### تست دستی روی سرور

از ریشهٔ پروژه، یا با مسیر کامل:

```bash
bash /www/wwwroot/task-manager/scripts/cron/generate.sh
bash /www/wwwroot/task-manager/scripts/cron/close-periods.sh
bash /www/wwwroot/task-manager/scripts/cron/backup.sh
bash /www/wwwroot/task-manager/scripts/cron/db-check.sh
echo $?
tail -n 20 /www/wwwroot/task-manager/logs/db-check-$(TZ=Asia/Tehran date +%F).log
```

`db-check` دادهٔ کاری را عوض نمی‌کند. `backup` فایل بکاپ می‌سازد. `generate` نمونهٔ دوره‌ها را می‌سازد و `close-periods` دوره‌های گذشتهٔ بی‌پاسخ را `MISSED` می‌کند؛ این دو را فقط وقتی عمداً می‌خواهید وضعیت کارها به‌روز شود اجرا کنید. پایان هر لاگ باید `کد خروج 0` باشد، مگر `db-check` مشکلی پیدا کرده باشد.

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
| `npm run cron:generate` / `cron:close` | کارهای زمان‌بندی از npm؛ روی سرور از `scripts/cron/*.sh` استفاده کنید |
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
| Cron کار نمی‌کند | لاگ `logs/` و خط `node:` را ببینید؛ در صورت نیاز `NODE_BIN` را در `.cron.env` بگذارید |
| Alert زرد «بررسی سلامت داده اجرا نشده» | اول لاگ‌های `LOG_DIR` و مسیر node در ابتدای لاگ `db-check` را چک کنید |
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

# سناریوی تست دستی — فاز ۷ (گزارش‌های مدیر)

## یکسان‌سازی /me/report و گزارش مدیر

- منطق نرخ: `ratesByPeriodEnd` در `server/queries/report-core.ts` (فیلتر روی `period_end`).
- `/me/report` از همان هسته استفاده می‌کند؛ تست: `src/lib/reports/parity.test.ts`.
- Excel: سلول‌های عددی با نوع number (`api/export/reports`).
- بنچمارک اندازه‌گیری‌شده: `npm run db:seed:large` سپس `npm run bench:reports` → `docs/BENCH_REPORTS.md`.

پیش‌نیاز: `npm run db:reset` سپس در صورت نیاز `npm run db:seed:large` برای داده حجیم.

| کاربر | رمز | نقش |
|---|---|---|
| `admin` | از `.env` | ADMIN — `reports.view_all` + export |
| `manager1` | `Manager@123456` | MANAGER — فقط دپارتمان خود |

---

## ۱) قاعده بازه و فرمول

1. کار ماهانه با `period_end` آخر ماه را بسازید؛ فیلتر همان ماه → در گزارش بیاید؛ ماه بعد → نیاید.
2. occurrence با `EXCUSED` و `PENDING` در درصد KPI لحاظ نشوند.
3. عدد «قابل شمارش» کارت خلاصه با تعداد ردیف‌های غیر PENDING/EXCUSED در تب جزئیات (همان فیلتر) یکی باشد.

## ۲) فیلترها و اشتراک لینک

1. `/admin/reports` — میان‌برهای امروز / هفته / ماه / ماه قبل / ۳ ماه / دلخواه.
2. فیلتر دپارتمان، پرسنل، دسته، نوع تکرار، اولویت را عوض کنید؛ URL عوض شود.
3. لینک را در تب دیگر باز کنید → همان فیلترها اعمال شود.
4. با `manager1` فقط دپارتمان خودش؛ `reports.export` برای Excel.

## ۳) تب‌های گزارش

1. **خلاصه:** KPI، Area روند با سوئیچ روزانه/هفتگی/ماهانه + خط میانگین، Donut وضعیت.
2. **پرسنل:** Bar افقی + جدول (streak)؛ کلیک نام → `/admin/staff/[id]?tab=report` با فیلترها.
3. **دپارتمان‌ها / کارها / الگوها / دلایل / جزئیات** را مرور کنید؛ empty state برای بازه خالی.
4. محور زمان: چپ قدیم، راست جدید (مستند در UI و `lib/reports/time-axis.ts`).

## ۴) پرسنل و داشبورد

1. `/admin/staff/[id]?tab=report` — همان کامپوننت‌ها محدود به یک نفر.
2. `/admin` — KPI واقعی، نمودار ماه، لیست نیازمند توجه (بی‌پاسخ امروز + زیر ۵۰٪ در ۷ روز).

## ۵) Excel و چاپ

1. دکمه Excel → سه شیت RTL، تاریخ شمسی، هدر freeze، نام فایل با بازه شمسی.
2. چاپ → A4؛ سایدبار و فیلترها مخفی؛ عنوان و بازه دیده شود.

## ۶) کارایی (seed:large)

پس از `npm run db:seed:large` روی ماشین توسعه اندازه‌گیری شد (تقریبی؛ محیط محلی):

| کوئری | زمان |
|---|---|
| `aggregateByDay` | ~۴۰–۱۲۰ms |
| `aggregateByStaff` | ~۸۰–۲۰۰ms |
| `listOccurrenceDetails` (۲۵ ردیف) | ~۳۰–۹۰ms |
| `aggregateStatusDonut` | ~۲۰–۶۰ms |

هدف: هر کوئری گزارش &lt; ۵۰۰ms. ایندکس‌های `period_end` و `(user_id, period_end)` اضافه شده‌اند.

---

تست خودکار: `npm test` — `lib/reports/reports.test.ts` (period_end، درصد، bucket هفته/ماه، یکسانی KPI/جزئیات).

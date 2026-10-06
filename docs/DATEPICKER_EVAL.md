# ارزیابی DatePicker شمسی — فاز B

## نتیجه

| معیار | وضعیت | پیاده‌سازی |
|---|---|---|
| نام ماه‌های شمسی | ✅ | `@daypicker/persian` + `faIR` |
| شروع هفته از شنبه | ✅ | پیش‌فرض تقویم جلالی DayPicker |
| ارقام فارسی | ✅ | `numerals="arabext"` (پیش‌فرض پکیج) |
| انتخاب بازه | ✅ | `JalaliDateRangePicker` (`mode="range"`) |
| چند روز جدا (تعطیلات) | ✅ | `JalaliMultiDatePicker` (`mode="multiple"`) |
| غیرفعال کردن تاریخ‌ها | ✅ | prop `disabled` / `disabledDates` روی Calendar |
| ناوبری کیبورد | ✅ | پشتیبانی native DayPicker |
| مرز اسفند کبیسه | ✅ | تأیید با `getDateLib` — ۱۴۰۳/۱۲/۳۰ معتبر است |

**تصمیم:** مسیر تک‌روز، بازه و چندروزه به `@daypicker/persian` منتقل شد.  
`react-multi-date-picker` دیگر در کد استفاده نمی‌شود و از وابستگی‌ها حذف می‌شود.

## ناشر و مسیر رسمی (فاز C)

| مورد | مقدار |
|---|---|
| پکیج | `@daypicker/persian@10.0.2` |
| ناشر / maintainer | **gpbl** (`io@gpbl.dev`) — همان نگهدارندهٔ `react-day-picker` |
| ریپو | `github.com/gpbl/react-day-picker` → `packages/persian` |
| مسیر قدیمی `react-day-picker/persian` | در **v10 وجود ندارد** (از exports حذف شده؛ تقویم‌های غیرمیلادی به add-on منتقل شده‌اند) |
| مستند رسمی | https://daypicker.dev/localization/persian → `npm i @daypicker/persian` |

**نتیجه بررسی:** مهاجرت به `react-day-picker/persian` ممکن نیست؛ `@daypicker/persian` خود مسیر رسمی فعلی است و نگه داشته می‌شود.

## قرارداد API (بدون تغییر Server Action)

- ورودی/خروجی: رشته میلادی `YYYY-MM-DD` (`GDate`)
- `JalaliDateField` فقط wrapper روی `JalaliDatePicker` برای سازگاری فرم‌های موجود است.

# UI Audit — فاز A (سیستم طراحی)

تاریخ: ۱۴۰۴/۰۷/۱۴ · به‌روزرسانی فاز F: ۱۴۰۴/۰۷/۱۴

## ۱) وضعیت فعلی `components/ui` (shadcn موجود)

| کامپوننت | مسیر | یادداشت |
|---|---|---|
| Button | `ui/button.tsx` | نگه‌داری؛ variantها کافی |
| Card | `ui/card.tsx` | نگه‌داری |
| Input | `ui/input.tsx` | فاز بعد: `text-base` موبایل |
| Label | `ui/label.tsx` | نگه‌داری |
| Textarea | `ui/textarea.tsx` | نگه‌داری |
| Checkbox | `ui/checkbox.tsx` | نگه‌داری |
| Select | `ui/select.tsx` | RTL فیزیکی → منطقی (فاز A) |
| Dialog | `ui/dialog.tsx` | RTL + الگوی Responsive (فاز B) |
| Badge | `ui/badge.tsx` | رنگ وضعیت از توکن |
| Separator | `ui/separator.tsx` | نگه‌داری |
| Skeleton | `ui/skeleton.tsx` | نگه‌داری |
| Sonner | `ui/sonner.tsx` | نگه‌داری |

## ۲) کامپوننت‌های دامنه / دست‌ساز و معادل shadcn

| دست‌ساز / فعلی | مسیر | معادل shadcn هدف | فاز |
|---|---|---|---|
| AppShell (aside+nav دستی) | `layout/app-shell.tsx` | **Sidebar** + Sheet + Breadcrumb + DropdownMenu | C ✅ |
| ThemeToggle | `theme-toggle.tsx` | Button + DropdownMenu (یا Toggle) | B/C ✅ |
| LoginForm / ChangePasswordForm | `auth/*` | Form (RHF+zod) یا useActionState + Input | B ✅ |
| LogoutButton | `auth/logout-button.tsx` | DropdownMenuItem / Button | C ✅ |
| StaffForm / PermissionsForm / NoteForm | `staff/*` | Form + Select + Dialog/Drawer | B/E ✅ |
| StaffActions / PasswordReveal | `staff/*` | DropdownMenu + AlertDialog + Dialog | B ✅ |
| Department forms/buttons | `departments/*` | Form + AlertDialog | B ✅ |
| Announcement forms/buttons | `announcements/*` | Form + AlertDialog | B ✅ |
| HolidayForm / Date multi | `holidays/*` | Calendar/DatePicker شمسی + Form | B ✅ |
| TaskForm / RecurrenceFields | `tasks/*` | Form + Tabs + Select + Responsive Dialog | B/E ✅ |
| AssigneePicker (لیست دستی) | `tasks/assignee-picker.tsx` | **Command + Popover** (Combobox) | B ✅ |
| OccurrencePreview | `tasks/occurrence-preview.tsx` | Card + Skeleton | E ✅ |
| BoardMatrix / StatusCell | `board/*` | Table + Badge (توکن وضعیت) + نمای موبایل | E ✅ |
| LeaveForm | `board/leave-form.tsx` | Form + Responsive Dialog | B ✅ |
| TodayBoard / TaskCard | `me/*` | ✅ Card + Progress + sticky — فاز D |
| ResponseSheet | `me/response-sheet.tsx` | ✅ ResponsiveDialog — فاز D |
| CalendarView | `me/calendar-view.tsx` | ✅ Grid مربعی + Drawer — فاز D |
| ReportView (me) | `me/report-view.tsx` | ✅ Card + Chart — فاز D |
| ReportShell / Filters / Charts | `reports/*` | Tabs/Select + Sheet فیلتر + Chart | B/F ✅ |
| EmptyChart / ChartSkeleton | `reports/empty-chart.tsx` | empty + Skeleton | F ✅ |
| JalaliDateField | `jalali/jalali-date-field.tsx` | Calendar shadcn persian | B ✅ |
| DateDisplay | `jalali/date-display.tsx` | نگه‌داری (نمایش؛ بدون معادل) | — |
| NotDoneReasonsForm | `settings/*` | Form + Input + Tabs صفحه | B ✅ |
| جداول admin | `app/admin/**` | **DataTable** + کارت موبایل | E/F ✅ |
| Confirm حذف | چند دکمه | **AlertDialog** | B ✅ |
| Progress/KPI | dashboard / reports | **Progress** + Card | F ✅ |
| Tabs | staff detail / reports | **Tabs** / Select موبایل | B/E/F ✅ |
| Tooltip | بورد/آیکن | **Tooltip** | B ✅ |
| Toggle Group | reports granularity / recurrence | **ToggleGroup** | B/F ✅ |
| Breadcrumb | هدر | **Breadcrumb** | C ✅ |
| Sidebar | `AppFrame` | **Sidebar** | C ✅ |
| Sheet / Drawer | فیلترها / جزئیات | **Sheet** + **Drawer** | B/C/F ✅ |
| Command / Combobox | assignee | **Command** + Popover | B ✅ |
| Chart | `reports/charts.tsx` | ChartContainer / Tooltip / Legend | B/F ✅ |

## ۳) وابستگی‌های UI

| پکیج | نقش | تصمیم |
|---|---|---|
| `recharts` | نمودار | نگه‌داری زیر Chart shadcn |
| `react-day-picker` + `@daypicker/persian` | تاریخ شمسی | جایگزین multi-date-picker |
| `lucide-react` | آیکن | نگه‌داری |
| `sonner` | toast | نگه‌داری |
| `next-themes` | تم | نگه‌داری |
| `@radix-ui/*` / `radix-ui` | پایه shadcn | نگه‌داری |

## ۴–۶) توکن‌ها / RTL / خارج از محدوده

بدون تغییر نسبت به فاز A؛ `lib/recurrence` و فرمول‌های aggregation گزارش دست‌نخورده مانده‌اند.

---

## ۷) وضعیت فاز B–E (خلاصه)

- shadcn کامل + Jalali + Chart + DataTable + AppFrame/Sidebar
- `/me` فاز D؛ admin جداول/بورد/فرم‌ها فاز E

---

## ۸) چک‌لیست مهاجرت فرم / دیالوگ → ResponsiveDialog + shadcn

**وضعیت: خالی از آیتم باز.** همه مسیرهای مهاجرت بسته شده‌اند (فاز F).

| # | مسیر | وضعیت | یادداشت |
|---|---|---|---|
| 1 | `staff/password-reveal-dialog.tsx` | ✅ | ResponsiveDialog |
| 2 | `auth/login-form.tsx` | ✅ | RHF+zod + useActionState |
| 3 | `auth/change-password-form.tsx` | ✅ | در پروفایل داخل ResponsiveDialog |
| 4 | `staff/staff-form.tsx` | ✅ | RHF+zod + Card + Switch |
| 5 | `staff/permissions-form.tsx` | ✅ | Switch + توضیح |
| 6 | `staff/note-form.tsx` | ✅ | useActionState + Label/Input/Textarea (فرم کوتاه؛ بدون دیالوگ) |
| 7 | `staff/staff-actions.tsx` | ✅ | AlertDialog حذف |
| 8 | `departments/department-create-form.tsx` | ✅ | useActionState + Input (ایجاد سریع inline) |
| 9 | `departments/department-delete-button.tsx` | ✅ | AlertDialog |
| 10 | `announcements/announcement-form.tsx` | ✅ | Select مخاطب + Switch سنجاق |
| 11 | `announcements/announcement-delete-button.tsx` | ✅ | AlertDialog |
| 12 | `holidays/holiday-form.tsx` | ✅ | Jalali multi |
| 13 | `holidays/holiday-delete-button.tsx` | ✅ | AlertDialog |
| 14 | `tasks/task-form.tsx` | ✅ | دو ستونه + Collapsible + sticky |
| 15 | `tasks/recurrence-fields.tsx` | ✅ | RadioGroup کارت + ToggleGroup |
| 16 | `board/leave-form.tsx` | ✅ | ResponsiveDialog + Range |
| 17 | `me/response-sheet.tsx` | ✅ | ResponsiveDialog |
| 18 | `me/avatar-form.tsx` | ✅ | Avatar |
| 19 | `settings/not-done-reasons-form.tsx` | ✅ | صفحه تنظیمات Tabs |
| 20 | فیلتر گزارش | ✅ | Select + Sheet موبایل |
| 21 | جداول admin | ✅ | DataTable (+ details گزارش) |
| 22 | `me/change-password-dialog.tsx` | ✅ | |
| 23 | گزارش‌ها (نمودار/چاپ/تب) | ✅ | فاز F |

**آخرین به‌روزرسانی:** پایان فاز F — هیچ ردیف ⏳ باقی نمانده.

### وضعیت فاز F (خلاصه)
- نمودارها: ارتفاع ریسپانسیو، legend زیر در موبایل، tick کمتر روی محور زمان، tooltip تاریخ کامل جلالی
- رتبه‌بندی پرسنل: پیش‌فرض ۱۰ + «نمایش همه»؛ ارتفاع متناسب ردیف
- هیت‌مپ: اسکرول افقی + برچسب sticky + Popover مقدار + راهنمای رنگ ثابت
- EmptyChart + ChartSkeleton + `loading.tsx`
- چاپ A4: عرض کامل، `break-inside: avoid`، تمایز B&W، مخفی sidebar/header/bottom-nav
- فیلتر Sheet موبایل؛ تب‌ها اسکرول / Select زیر `sm`؛ Excel+چاپ در PageHeader
- جزئیات → `DetailsDataTable` با `renderMobileCard`

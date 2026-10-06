"use client";

import { JalaliDatePicker } from "@/components/jalali/jalali-date-picker";

type Props = {
  name: string;
  label: string;
  value?: string | null;
  required?: boolean;
  disabled?: boolean;
  onChange?: (gDate: string | null) => void;
};

/** سازگاری با فرم‌های قبلی — همان قرارداد YYYY-MM-DD */
export function JalaliDateField(props: Props) {
  return <JalaliDatePicker {...props} />;
}

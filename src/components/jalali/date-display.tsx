import { format as formatJalali } from "date-fns-jalali";
import { faIR } from "date-fns-jalali/locale/fa-IR";
import { toFaDigits } from "@/lib/utils";

type DateDisplayProps = {
  value: Date | string | number | null | undefined;
  pattern?: string;
  className?: string;
  fallback?: string;
};

export function DateDisplay({
  value,
  pattern = "yyyy/MM/dd",
  className,
  fallback = "—",
}: DateDisplayProps) {
  if (value === null || value === undefined || value === "") {
    return <span className={className}>{fallback}</span>;
  }

  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return <span className={className}>{fallback}</span>;
  }

  const formatted = formatJalali(date, pattern, { locale: faIR });
  return <span className={className}>{toFaDigits(formatted)}</span>;
}

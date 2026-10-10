"use client";

import { choiceChipClass } from "@/components/ui/choice-chip";

export function DepartmentChips({
  departments,
  selected,
  onChange,
  disabled,
  emptyHint = "بدون انتخاب، این دلیل برای همه دپارتمان‌ها نمایش داده می‌شود.",
  selectedHint = "فقط پرسنل دپارتمان‌های انتخاب‌شده این دلیل را می‌بینند.",
}: {
  departments: Array<{ id: number; name: string }>;
  selected: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  emptyHint?: string;
  selectedHint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {departments.map((department) => {
          const on = selected.includes(department.id);
          return (
            <button
              key={department.id}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() =>
                onChange(
                  on
                    ? selected.filter((id) => id !== department.id)
                    : [...selected, department.id],
                )
              }
              className={choiceChipClass(on)}
            >
              {department.name}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        {selected.length === 0 ? emptyHint : selectedHint}
      </p>
    </div>
  );
}

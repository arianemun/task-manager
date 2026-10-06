import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  /** ستون‌ها از sm به بالا */
  cols?: 1 | 2;
};

/** فاصله فیلدها ۲۰px (`gap-5`) — docs/SPACING.md */
export function FormGrid({ children, className, cols = 1 }: Props) {
  return (
    <div
      className={cn(
        "grid gap-5",
        cols === 2 && "sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

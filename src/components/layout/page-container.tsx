import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** عرض باریک‌تر برای صفحات /me */
  narrow?: boolean;
  className?: string;
};

/** padding صفحه: ۱۶ / ۲۴ / ۳۲ — docs/SPACING.md */
export function PageContainer({ children, narrow = false, className }: Props) {
  return (
    <div
      data-page-container
      className={cn(
        "mx-auto w-full flex-1",
        "py-4 md:py-6 lg:py-8",
        narrow ? "max-w-4xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

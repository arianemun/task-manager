import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Gap = "sm" | "md" | "lg";

const GAP: Record<Gap, string> = {
  sm: "gap-4",
  /** فاصله بخش‌های اصلی: ۲۴ موبایل / ۳۲ دسکتاپ */
  md: "gap-6 md:gap-8",
  lg: "gap-8 md:gap-10",
};

type Props = {
  children: ReactNode;
  gap?: Gap;
  className?: string;
  as?: "div" | "section";
};

export function Stack({
  children,
  gap = "md",
  className,
  as: Tag = "div",
}: Props) {
  return <Tag className={cn("flex flex-col", GAP[gap], className)}>{children}</Tag>;
}

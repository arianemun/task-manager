import { cn } from "@/lib/utils";

/** chip انتخابی: pill با فاصله، بدون گوشهٔ صاف دکمه‌های میانی. */
export function choiceChipClass(on: boolean, className?: string) {
  return cn(
    "inline-flex h-10 items-center rounded-full border border-input bg-muted px-[14px] text-sm font-medium transition-colors",
    "disabled:opacity-50",
    on
      ? "border-transparent bg-accent text-accent-foreground"
      : "hover:bg-accent/60",
    className,
  );
}

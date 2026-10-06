import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyChart({
  label = "در این بازه داده‌ای نیست",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex h-40 items-center justify-center rounded-xl border border-dashed text-sm sm:h-48",
        className,
      )}
      role="status"
    >
      {label}
    </div>
  );
}

/** اسکلتون نمودار هنگام بارگذاری */
export function ChartSkeleton({
  className,
  heightClass = "h-40 sm:h-64",
}: {
  className?: string;
  heightClass?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border p-3",
        className,
      )}
      aria-busy="true"
      aria-label="در حال بارگذاری نمودار"
    >
      <Skeleton className={cn("w-full rounded-lg", heightClass)} />
      <div className="flex flex-wrap justify-center gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, className }: Props) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <Icon className="size-10 opacity-40" aria-hidden />
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description ? <p className="max-w-xs text-xs">{description}</p> : null}
    </div>
  );
}

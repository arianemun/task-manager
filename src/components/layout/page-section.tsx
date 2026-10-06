import type { ReactNode } from "react";
import { Stack } from "@/components/layout/stack";

type Props = {
  children: ReactNode;
  title?: string;
  description?: ReactNode;
  className?: string;
};

/** یک بخش صفحه: یک هدف، فاصله داخلی استاندارد */
export function PageSection({
  children,
  title,
  description,
  className,
}: Props) {
  return (
    <Stack as="section" gap="sm" className={className}>
      {title || description ? (
        <div className="space-y-2">
          {title ? (
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          ) : null}
          {description ? (
            <div className="text-muted-foreground text-sm leading-[1.7]">
              {description}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </Stack>
  );
}

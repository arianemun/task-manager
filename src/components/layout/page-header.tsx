"use client";

import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fa } from "@/lib/i18n/fa";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: ReactNode;
  /** عملیات اصلی — همیشه دیده می‌شود */
  primaryAction?: ReactNode;
  /** عملیات ثانویه — روی موبایل داخل منو */
  secondaryActions?: Array<{
    key: string;
    label: string;
    onSelect?: () => void;
    href?: string;
    node?: ReactNode;
  }>;
  className?: string;
  children?: ReactNode;
};

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  className,
  children,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <div className="text-muted-foreground text-sm leading-[1.7]">
            {description}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {primaryAction ? (
          <div
            className={cn(
              secondaryActions && secondaryActions.length > 0 && "hidden md:flex",
            )}
          >
            {primaryAction}
          </div>
        ) : null}
        {secondaryActions && secondaryActions.length > 0 ? (
          <>
            <div className="hidden items-center gap-2 md:flex">
              {secondaryActions.map((a) =>
                a.node ? <div key={a.key}>{a.node}</div> : null,
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  aria-label={fa.common.actions}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {secondaryActions.map((a) => (
                  <DropdownMenuItem
                    key={a.key}
                    onSelect={a.onSelect}
                    asChild={Boolean(a.href || a.node)}
                  >
                    {a.href ? (
                      <a href={a.href}>{a.label}</a>
                    ) : a.node ? (
                      <div>{a.node}</div>
                    ) : (
                      <span>{a.label}</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
        {children}
      </div>
    </div>
  );
}

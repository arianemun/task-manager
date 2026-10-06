"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PATH_LABELS } from "@/config/nav";
import { toFaDigits } from "@/lib/utils";

function labelFor(segment: string, index: number, all: string[]): string {
  if (PATH_LABELS[segment]) return PATH_LABELS[segment];
  if (/^\d+$/.test(segment)) {
    const parent = all[index - 1];
    if (parent === "staff") return `پرسنل #${toFaDigits(segment)}`;
    if (parent === "tasks") return `کار #${toFaDigits(segment)}`;
    return `#${toFaDigits(segment)}`;
  }
  return segment;
}

export function AppBreadcrumbs() {
  const pathname = usePathname() || "/";
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) return null;

  const crumbs = parts.map((seg, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    return { href, label: labelFor(seg, i, parts) };
  });

  const current = crumbs[crumbs.length - 1]!;

  return (
    <>
      {/* موبایل: فقط عنوان فعلی */}
      <p className="truncate text-sm font-medium md:hidden">{current.label}</p>

      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={c.href}>
                {i > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem>
                  {last ? (
                    <BreadcrumbPage>{c.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={c.href}>{c.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}

"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { fa } from "@/lib/i18n/fa";

type Props = {
  title?: string;
  description: ReactNode;
  canExport: boolean;
  exportHref: string;
};

export function ReportPageHeader({
  title = fa.nav.reports,
  description,
  canExport,
  exportHref,
}: Props) {
  return (
    <PageHeader
      title={title}
      description={description}
      className="report-title mb-0"
      secondaryActions={[
        ...(canExport
          ? [
              {
                key: "excel",
                label: "خروجی Excel",
                href: exportHref,
                node: (
                  <Button asChild variant="outline">
                    <a href={exportHref}>خروجی Excel</a>
                  </Button>
                ),
              },
            ]
          : []),
        {
          key: "print",
          label: "چاپ",
          onSelect: () => window.print(),
          node: (
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.print()}
            >
              چاپ
            </Button>
          ),
        },
      ]}
    />
  );
}

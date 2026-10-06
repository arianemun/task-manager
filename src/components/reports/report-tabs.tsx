"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { REPORT_TABS } from "@/components/reports/report-tab-defs";

export type { ReportTabId } from "@/components/reports/report-tab-defs";
export { REPORT_TABS };

type Props = {
  activeTab: string;
  hrefForTab: Record<string, string>;
};

export function ReportTabsNav({ activeTab, hrefForTab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const listRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    const root = listRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>('[data-state="active"]');
    active?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeTab, mounted]);

  function go(tab: string) {
    const href = hrefForTab[tab];
    if (href) {
      router.push(href);
      return;
    }
    const params = new URLSearchParams(sp.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`);
  }

  const select = (
    <Select value={activeTab} onValueChange={go}>
      <SelectTrigger className="min-h-11 w-full" aria-label="بخش گزارش">
        <SelectValue placeholder="بخش گزارش" />
      </SelectTrigger>
      <SelectContent>
        {REPORT_TABS.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // تا mount فقط Select — جلوگیری از mismatch Radix Tabs/Select
  if (!mounted) {
    return <div className="print:hidden w-full">{select}</div>;
  }

  return (
    <div className="print:hidden w-full">
      <div className="sm:hidden">{select}</div>
      <Tabs
        value={activeTab}
        onValueChange={go}
        className="hidden w-full sm:block"
      >
        <div ref={listRef} className="w-full overflow-x-auto">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1">
            {REPORT_TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="shrink-0">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
    </div>
  );
}

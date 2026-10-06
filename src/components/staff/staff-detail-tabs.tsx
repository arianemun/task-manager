"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { id: "info", label: "اطلاعات" },
  { id: "tasks", label: "کارها" },
  { id: "notes", label: "یادداشت‌ها" },
  { id: "report", label: "گزارش" },
] as const;

type Props = {
  userId: number;
  active: "info" | "tasks" | "notes" | "report";
};

export function StaffDetailTabs({ active }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function go(tab: string) {
    const params = new URLSearchParams(sp.toString());
    if (tab === "info") {
      params.delete("tab");
      for (const k of [
        "range",
        "from",
        "to",
        "departmentId",
        "userId",
        "categoryId",
        "recurrenceType",
        "priority",
        "q",
        "page",
        "granularity",
      ]) {
        params.delete(k);
      }
    } else if (tab === "report") {
      params.set("tab", "summary");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Tabs value={active} onValueChange={go} className="w-full print:hidden">
      <TabsList className="h-auto w-full justify-start overflow-x-auto">
        {TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="shrink-0">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

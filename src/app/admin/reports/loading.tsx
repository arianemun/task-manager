import { ChartSkeleton } from "@/components/reports/empty-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Stack } from "@/components/layout/stack";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

export default function ReportsLoading() {
  return (
    <Stack aria-busy="true" aria-label="بارگذاری گزارش">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-11 w-full md:h-24" />
      <Skeleton className="h-11 w-full sm:h-10" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <ChartSkeleton />
        </CardContent>
      </Card>
    </Stack>
  );
}

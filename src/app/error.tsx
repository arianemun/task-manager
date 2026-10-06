"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-muted-foreground text-sm">خطای ۵۰۰</p>
      <h1 className="text-2xl font-semibold">مشکلی پیش آمد</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        لطفاً دوباره تلاش کنید. اگر ادامه داشت با مدیر سامانه تماس بگیرید.
      </p>
      <Button type="button" onClick={() => reset()}>
        تلاش مجدد
      </Button>
    </div>
  );
}

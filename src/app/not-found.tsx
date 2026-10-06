import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-muted-foreground text-sm">خطای ۴۰۴</p>
      <h1 className="text-2xl font-semibold">صفحه پیدا نشد</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        آدرس واردشده وجود ندارد یا به آن دسترسی ندارید.
      </p>
      <Button asChild>
        <Link href="/login">بازگشت به ورود</Link>
      </Button>
    </div>
  );
}

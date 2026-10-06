"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function RerunHealthButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "در حال بررسی…" : "اجرای دوباره"}
    </Button>
  );
}

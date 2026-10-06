"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { fa } from "@/lib/i18n/fa";

export function LogoutButton({
  variant = "ghost",
  className,
}: {
  variant?: "ghost" | "outline" | "default";
  className?: string;
}) {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant={variant} className={className} size="sm">
        <LogOut className="size-4" />
        {fa.auth.logout}
      </Button>
    </form>
  );
}

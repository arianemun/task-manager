"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { fa } from "@/lib/i18n/fa";
import { cn } from "@/lib/utils";
import { Input } from "./input";

function PasswordInput({ className, disabled, ...props }: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative" dir="ltr">
      <Input
        {...props}
        disabled={disabled}
        type={visible ? "text" : "password"}
        className={cn("pe-11", className)}
      />
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 end-0 flex w-11 items-center justify-center"
        aria-label={visible ? fa.auth.hidePassword : fa.auth.showPassword}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

export { PasswordInput };

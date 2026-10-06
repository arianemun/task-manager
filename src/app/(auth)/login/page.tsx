import { ClipboardList } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { redirectIfAuthenticated } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.03_220)_0%,_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.04_230)_0%,_transparent_55%)]"
      />
      <div className="absolute start-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <Card className="relative z-10 w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full">
            <ClipboardList className="size-6" />
          </div>
          <CardTitle className="text-xl">{fa.appName}</CardTitle>
          <CardDescription>{fa.auth.login}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}

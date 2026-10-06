import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";

export default async function ChangePasswordPage() {
  const user = await requireUserOrRedirect({
    allowMustChangePassword: true,
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{fa.auth.changePassword}</CardTitle>
          <CardDescription>
            {user.mustChangePassword
              ? fa.auth.mustChangePassword
              : `${user.fullName} — تغییر رمز عبور`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ChangePasswordForm />
          <div className="flex justify-center">
            <LogoutButton variant="outline" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

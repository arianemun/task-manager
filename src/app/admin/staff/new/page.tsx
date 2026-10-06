import { StaffForm } from "@/components/staff/staff-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { listDepartmentsForSelect } from "@/server/queries/staff";

export default async function NewStaffPage() {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  const departments = listDepartmentsForSelect(actor);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">پرسنل جدید</h1>
        <p className="text-muted-foreground text-sm">
          پس از ذخیره، رمز موقت فقط یک‌بار نمایش داده می‌شود.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>اطلاعات حساب</CardTitle>
          <CardDescription>
            {actor.role === "MANAGER"
              ? "پرسنل در دپارتمان شما ثبت می‌شود"
              : "نقش و مجوز را با دقت انتخاب کنید"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaffForm
            mode="create"
            departments={departments}
            actorRole={actor.role}
          />
        </CardContent>
      </Card>
    </div>
  );
}

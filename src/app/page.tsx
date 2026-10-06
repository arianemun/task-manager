import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";

/** ریشه سایت: مهمان → ورود؛ مدیر → پنل؛ پرسنل → کارهای من */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  if (user.role === "ADMIN" || user.role === "MANAGER") {
    redirect("/admin");
  }
  redirect("/me");
}

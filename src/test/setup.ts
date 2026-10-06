import { afterEach } from "vitest";
import { resetNowProvider } from "@/lib/dates";

afterEach(() => {
  resetNowProvider();
});

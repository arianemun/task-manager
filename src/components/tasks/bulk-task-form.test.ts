/**
 * @vitest-environment happy-dom
 */
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkTaskForm } from "./bulk-task-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined }),
}));

vi.mock("sonner", () => ({
  toast: { error: () => undefined, success: () => undefined, message: () => undefined },
}));

vi.mock("@/server/actions/tasks", () => ({
  bulkCreateTasksAction: async () => ({ ok: true, taskIds: [1, 2, 3, 4] }),
}));

describe("فرم افزودن چند کار", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it("پنج خط با خالی و تکراری را به چهار عنوان پیش‌نمایش می‌کند", async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        createElement(BulkTaskForm, {
          categories: [],
          staff: [{ id: 1, fullName: "پرسنل" }],
          departments: [{ id: 2, name: "کافه" }],
          activeTitles: ["پولیش"],
          startDate: "2026-10-08",
        }),
      );
    });
    const area = host.querySelector("textarea");
    expect(area).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(area, "نظافت\n\nنظافت\nجارو\nپولیش\nشستشو");
      area!.dispatchEvent(new Event("input", { bubbles: true }));
      area!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const preview = host.querySelector("ul");
    expect(host.textContent).toContain("۴");
    expect(preview?.textContent).toContain("نظافت");
    expect(preview?.textContent).toContain("جارو");
    expect(preview?.textContent).toContain("شستشو");
    expect(preview?.textContent).toContain("این عنوان با یک کار فعال موجود یکی است");
    expect(preview?.querySelectorAll("li").length).toBe(4);
  });
});

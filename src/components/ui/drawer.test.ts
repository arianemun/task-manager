/**
 * @vitest-environment happy-dom
 */
import { createElement, useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "./drawer";

function pointer(type: string): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, button: 0 });
}

function Harness({ onAllow }: { onAllow: () => void }) {
  const [open] = useState(true);
  return createElement(
    Drawer,
    { open },
    createElement(
      DrawerContent,
      null,
      createElement(
        DrawerHeader,
        null,
        createElement(DrawerTitle, null, "عنوان"),
        createElement(
          "button",
          { type: "button", "data-testid": "header-action", onClick: onAllow },
          "بستن",
        ),
      ),
      createElement(
        "button",
        { type: "button", "data-testid": "allow", onClick: onAllow },
        "اجازه دادن",
      ),
      createElement("input", { type: "file", "data-testid": "file", onClick: onAllow }),
      createElement("div", { role: "button", tabIndex: 0, "data-testid": "chip", onClick: onAllow }, "دلیل"),
    ),
  );
}

describe("drawer clicks", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  const captured: Element[] = [];
  const original = Element.prototype.setPointerCapture;

  afterEach(() => {
    Element.prototype.setPointerCapture = original;
    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = null;
    host = null;
    captured.length = 0;
  });

  async function render(onAllow: () => void) {
    Element.prototype.setPointerCapture = function capture(this: Element) {
      captured.push(this);
    };
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(createElement(Harness, { onAllow }));
    });
  }

  function control(testId: string): HTMLElement {
    const node = document.querySelector(`[data-testid="${testId}"]`);
    if (!(node instanceof HTMLElement)) throw new Error(testId);
    return node;
  }

  it("runs onClick after pointerdown and pointerup without capturing the button", async () => {
    let clicks = 0;
    await render(() => {
      clicks += 1;
    });

    for (const id of ["allow", "header-action", "file", "chip"]) {
      captured.length = 0;
      const node = control(id);
      node.dispatchEvent(pointer("pointerdown"));
      node.dispatchEvent(pointer("pointerup"));
      node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(captured, id).toEqual([]);
      expect(clicks, id).toBeGreaterThan(0);
    }
    expect(clicks).toBe(4);
  });

  it("still captures the pointer on the handle and the header", async () => {
    await render(() => undefined);
    const handle = document.querySelector("[data-slot='drawer-content'] [data-vaul-drag]");
    const title = document.querySelector("[data-slot='drawer-title']");
    if (!(handle instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      throw new Error("drag zones missing");
    }

    captured.length = 0;
    handle.dispatchEvent(pointer("pointerdown"));
    expect(captured.length).toBeGreaterThan(0);

    captured.length = 0;
    title.dispatchEvent(pointer("pointerdown"));
    expect(captured.length).toBeGreaterThan(0);
  });
});

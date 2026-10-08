/**
 * @vitest-environment happy-dom
 */
import { createElement, useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useSubmitLock } from "./submit-lock";

function Harness({
  onSubmit,
}: {
  onSubmit: () => void;
}) {
  const [pending, setPending] = useState(false);
  const { guard, release } = useSubmitLock(pending);
  return createElement(
    "form",
    {
      "data-testid": "form",
      onSubmit: (event: Event) => {
        event.preventDefault();
        if (guard(event)) return;
        const title = (event.currentTarget as HTMLFormElement).querySelector("input");
        if (!title?.value) {
          release();
          return;
        }
        setPending(true);
        onSubmit();
      },
    },
    createElement("input", { name: "title", defaultValue: "کار" }),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "done",
        onClick: () => setPending(false),
      },
      "تمام",
    ),
  );
}

describe("useSubmitLock", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it("blocks a second submit until pending clears", () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    let calls = 0;
    act(() => {
      root!.render(createElement(Harness, { onSubmit: () => calls++ }));
    });
    const form = host.querySelector("form")!;
    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });
    expect(calls).toBe(1);
    act(() => {
      host!.querySelector<HTMLButtonElement>("[data-testid=done]")!.click();
    });
    act(() => {
      form.requestSubmit();
    });
    expect(calls).toBe(2);
  });

  it("releases the lock when client validation fails", () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    let calls = 0;
    act(() => {
      root!.render(createElement(Harness, { onSubmit: () => calls++ }));
    });
    const form = host.querySelector("form")!;
    const input = form.querySelector("input")!;
    input.value = "";
    act(() => {
      form.requestSubmit();
    });
    expect(calls).toBe(0);
    input.value = "کار";
    act(() => {
      form.requestSubmit();
    });
    expect(calls).toBe(1);
  });
});

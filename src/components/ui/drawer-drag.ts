const INTERACTIVE =
  "button, a, input, textarea, select, label, [role='button'], [role='checkbox'], [role='switch'], [role='radio'], [role='menuitem'], [role='option'], [role='combobox'], [role='tab'], [data-vaul-no-drag]";

/** True only for the handle and header, and never for a control inside them. */
export function drawerPointerReachesVaul(target: EventTarget | null): boolean {
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (!element) return false;
  if (element.closest(INTERACTIVE)) return false;
  return Boolean(element.closest("[data-vaul-drag]"));
}

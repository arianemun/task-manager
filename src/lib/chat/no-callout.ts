/** دکمهٔ نگه داشتن ویس و ویدیو مسیج فاز ۵. touchstart باید passive:false باشد. */
export function bindNoCallout(element: HTMLElement): () => void {
  const blockTouch = (event: TouchEvent) => {
    event.preventDefault();
  };
  const blockMenu = (event: Event) => {
    event.preventDefault();
  };
  element.addEventListener("touchstart", blockTouch, { passive: false });
  element.addEventListener("contextmenu", blockMenu);
  return () => {
    element.removeEventListener("touchstart", blockTouch);
    element.removeEventListener("contextmenu", blockMenu);
  };
}

export function capturePointer(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // پنجرهٔ سیستم ممکن است اشاره‌گر را قبل از capture تمام کند.
  }
}

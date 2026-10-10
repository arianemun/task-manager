export function isOtherNotDoneReason(
  reason: { code: string; label: string } | null | undefined,
): boolean {
  if (!reason) return false;
  return reason.code === "other" || reason.label.trim() === "سایر";
}

/** توضیح برای «سایر» الزامی است. requiresNote کار، برای هر دلیلی الزامی می‌ماند. */
export function notDoneNoteRequired(input: {
  requiresNote: boolean;
  reason: { code: string; label: string } | null | undefined;
}): boolean {
  if (input.requiresNote) return true;
  return isOtherNotDoneReason(input.reason);
}

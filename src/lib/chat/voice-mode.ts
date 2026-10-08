export const VOICE_TAP_MS = 250;

/** ضربه کوتاه قفل می‌شود. نگه داشتن، ضبط دستی است. رها شدن بعد از ۲۵۰ms یعنی پنجره سیستم آمده. */
export function voiceStartMode(
  elapsedMs: number,
  fingerDown: boolean,
): "locked" | "hold" | "interrupted" {
  if (fingerDown) return "hold";
  if (elapsedMs < VOICE_TAP_MS) return "locked";
  return "interrupted";
}

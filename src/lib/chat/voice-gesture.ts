export type VoiceGesture = "recording" | "cancel" | "lock";

/** dy منفی یعنی حرکت به بالا. لغو با کشیدن افقی است تا در RTL و LTR هر دو کار کند. */
export function voiceGesture(dx: number, dy: number): VoiceGesture {
  if (dy <= -72) return "lock";
  if (Math.abs(dx) >= 88) return "cancel";
  return "recording";
}

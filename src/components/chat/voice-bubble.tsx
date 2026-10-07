"use client";

import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return toFaDigits(`${minutes}:${seconds}`);
}

export function VoiceBubble({
  url,
  waveform,
  durationMs,
}: {
  url: string;
  waveform: number[] | null;
  durationMs: number | null;
}) {
  const bars = waveform && waveform.length > 0 ? waveform : [30, 60, 40, 80, 50];
  return (
    <div className="mb-1 w-full max-w-xs">
      <div className="mb-1 flex h-8 items-end gap-px" aria-hidden="true">
        {bars.map((value, index) => (
          <span
            key={index}
            className="bg-primary/70 w-1 rounded-sm"
            style={{ height: `${Math.max(12, Math.min(100, value))}%` }}
          />
        ))}
      </div>
      <audio src={url} controls preload="metadata" className="h-8 w-full" aria-label={fa.chat.voicePlay} />
      {durationMs ? <p className="text-muted-foreground mt-1 text-xs">{clock(durationMs)}</p> : null}
    </div>
  );
}

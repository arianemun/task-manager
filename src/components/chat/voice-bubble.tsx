"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
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
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const bars = waveform && waveform.length > 0 ? waveform : [30, 60, 40, 80, 50, 70, 35];

  return (
    <div className="flex h-11 items-center gap-2" dir="ltr">
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onTimeUpdate={(event) => {
          const node = event.currentTarget;
          if (node.duration) setProgress(node.currentTime / node.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
      />
      <button
        type="button"
        className="inline-flex size-8 items-center justify-center"
        aria-label={fa.chat.voicePlay}
        onClick={() => {
          const node = audio.current;
          if (!node) return;
          if (node.paused) {
            void node.play();
            setPlaying(true);
          } else {
            node.pause();
            setPlaying(false);
          }
        }}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div
        className="flex h-8 min-w-0 flex-1 items-center gap-px"
        onPointerDown={(event) => {
          const node = audio.current;
          if (!node || !node.duration) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
          node.currentTime = ratio * node.duration;
          setProgress(ratio);
        }}
      >
        {bars.map((value, index) => (
          <span
            key={index}
            className={index / bars.length < progress ? "bg-current w-0.5 rounded-sm" : "bg-current/40 w-0.5 rounded-sm"}
            style={{ height: `${Math.max(4, Math.min(28, value / 3.2))}px` }}
          />
        ))}
      </div>
      <span className="w-10 shrink-0 text-[11px] tabular-nums">
        {durationMs ? clock(durationMs) : ""}
      </span>
    </div>
  );
}

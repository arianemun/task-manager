"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Mic } from "lucide-react";
import { fa } from "@/lib/i18n/fa";
import { CHAT_VOICE_MAX_MS } from "@/lib/chat/types";
import { voiceGesture, type VoiceGesture } from "@/lib/chat/voice-gesture";
import { toFaDigits } from "@/lib/utils";

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return toFaDigits(`${minutes}:${seconds}`);
}

export function VoiceHold({
  onRecorded,
  onError,
}: {
  onRecorded: (file: File) => void;
  onError: (message: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "cancel" | "locked">("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const discard = useRef(false);
  const started = useRef(0);
  const origin = useRef({ x: 0, y: 0 });
  const stream = useRef<MediaStream | null>(null);
  const limit = useRef<number | null>(null);
  const session = useRef(0);
  const gesture = useRef<VoiceGesture>("recording");

  function stopTracks() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (limit.current) window.clearTimeout(limit.current);
    limit.current = null;
  }

  function finish(send: boolean) {
    session.current += 1;
    discard.current = !send;
    const active = recorder.current;
    if (active && active.state !== "inactive") active.stop();
    else stopTracks();
    setPhase("idle");
    setElapsed(0);
  }

  useEffect(() => () => stopTracks(), []);

  useEffect(() => {
    if (phase === "idle") return;
    const timer = window.setInterval(() => setElapsed(Date.now() - started.current), 200);
    return () => window.clearInterval(timer);
  }, [phase]);

  async function begin(event: PointerEvent<HTMLButtonElement>) {
    if (phase !== "idle") return;
    event.preventDefault();
    onError("");
    const token = session.current + 1;
    session.current = token;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (session.current !== token) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(media, { mimeType: mime }) : new MediaRecorder(media);
      chunks.current = [];
      discard.current = false;
      rec.ondataavailable = (item) => {
        if (item.data.size > 0) chunks.current.push(item.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const tooShort = Date.now() - started.current < 500;
        stopTracks();
        if (!discard.current && !tooShort && blob.size > 0) {
          onRecorded(new File([blob], `voice.${extensionFor(type)}`, { type }));
        } else if (!discard.current && tooShort) {
          onError(fa.chat.voiceTooShort);
        }
        setPhase("idle");
      };
      recorder.current = rec;
      started.current = Date.now();
      gesture.current = "recording";
      origin.current = { x: event.clientX, y: event.clientY };
      rec.start();
      setPhase("recording");
      setElapsed(0);
      event.currentTarget.setPointerCapture(event.pointerId);
      limit.current = window.setTimeout(() => finish(true), CHAT_VOICE_MAX_MS);
    } catch {
      stopTracks();
      onError(fa.chat.voiceDenied);
    }
  }

  return (
    <div className="relative">
      {phase !== "idle" ? (
        <div className="bg-card absolute bottom-full end-0 z-10 mb-2 flex w-64 items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <span>{clock(elapsed)}</span>
          {phase === "locked" ? (
            <span className="flex gap-2">
              <button type="button" className="min-h-11" onClick={() => finish(false)}>
                {fa.chat.voiceCancel}
              </button>
              <button type="button" className="min-h-11" onClick={() => finish(true)}>
                {fa.chat.send}
              </button>
            </span>
          ) : (
            <span>{phase === "cancel" ? fa.chat.voiceCancel : fa.chat.slideToCancel}</span>
          )}
        </div>
      ) : null}
      <button
        type="button"
        className="border-input inline-flex size-11 shrink-0 items-center justify-center rounded-md border md:size-10"
        aria-label={phase === "locked" ? fa.chat.voiceLocked : fa.chat.holdToRecord}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => void begin(event)}
        onPointerMove={(event) => {
          if (gesture.current === "lock") return;
          const next = voiceGesture(event.clientX - origin.current.x, event.clientY - origin.current.y);
          gesture.current = next;
          setPhase(next === "lock" ? "locked" : next);
          setElapsed(Date.now() - started.current);
        }}
        onPointerUp={() => {
          if (gesture.current === "lock") return;
          finish(gesture.current === "recording");
        }}
        onPointerCancel={() => {
          if (phase !== "locked") finish(false);
        }}
      >
        <Mic className="size-5" />
      </button>
    </div>
  );
}

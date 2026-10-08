"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Mic, Pause, Play, Send, Square, Trash2 } from "lucide-react";
import { MediaPermissionDrawer } from "@/components/permissions/media-permission-drawer";
import { fa } from "@/lib/i18n/fa";
import { bindNoCallout, capturePointer } from "@/lib/chat/no-callout";
import { CHAT_VOICE_MAX_MS } from "@/lib/chat/types";
import { voiceGesture, type VoiceGesture } from "@/lib/chat/voice-gesture";
import { voiceStartMode } from "@/lib/chat/voice-mode";
import { getPermissionStatus, markSessionMedia, sessionMediaGranted } from "@/lib/permissions/browser";
import {
  interpretGetUserMedia,
  isIosUserAgent,
  shouldCaptureMedia,
  type PermissionStatus,
} from "@/lib/permissions/status";
import { toFaDigits } from "@/lib/utils";

const HINT_KEY = "tm-voice-hint";

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

type Preview = {
  url: string;
  file: File;
  durationMs: number;
  waveform: number[];
};

type Intent = "send" | "discard" | "preview";

function Wave({
  bars,
  progress = 0,
  onSeek,
}: {
  bars: number[];
  progress?: number;
  onSeek?: (ratio: number) => void;
}) {
  const shown = bars.length > 0 ? bars : [24, 48, 32, 60, 40];
  return (
    <div
      className="flex h-8 min-w-0 flex-1 items-center gap-px"
      dir="ltr"
      onPointerDown={
        onSeek
          ? (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientX - rect.left) / rect.width;
              onSeek(Math.min(1, Math.max(0, ratio)));
            }
          : undefined
      }
    >
      {shown.map((value, index) => (
        <span
          key={index}
          className={index / shown.length < progress ? "bg-primary w-1 rounded-sm" : "bg-primary/40 w-1 rounded-sm"}
          style={{ height: `${Math.max(4, Math.min(28, value / 3.2))}px` }}
        />
      ))}
    </div>
  );
}

export function VoiceHold({
  onRecorded,
  onError,
}: {
  onRecorded: (file: File) => void;
  onError: (message: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "cancel" | "locked" | "preview">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const downAt = useRef(0);
  const origin = useRef({ x: 0, y: 0 });
  const stream = useRef<MediaStream | null>(null);
  const limit = useRef<number | null>(null);
  const session = useRef(0);
  const gesture = useRef<VoiceGesture>("recording");
  const holding = useRef(false);
  const pressed = useRef(false);
  const stopping = useRef(false);
  const intent = useRef<Intent>("discard");
  const hint = useRef<PermissionStatus>("unknown");
  const barsRef = useRef<number[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const [gate, setGate] = useState<PermissionStatus | null>(null);
  const [ios, setIos] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const endRef = useRef<(next: Intent) => void>(() => undefined);

  function stopTracks() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (limit.current) window.clearTimeout(limit.current);
    limit.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    analyser.current = null;
  }

  function clearPreview(current: Preview | null) {
    if (current) URL.revokeObjectURL(current.url);
    setPreview(null);
    setPlaying(false);
    setProgress(0);
  }

  function endRecording(next: Intent) {
    if (stopping.current) return;
    const active = recorder.current;
    holding.current = false;
    if (!active || active.state === "inactive") {
      stopTracks();
      setPhase("idle");
      setBars([]);
      barsRef.current = [];
      return;
    }
    stopping.current = true;
    intent.current = next;
    active.stop();
  }
  endRef.current = endRecording;

  useEffect(() => {
    setIos(isIosUserAgent(navigator.userAgent, navigator.platform, navigator.maxTouchPoints));
    setShowHint(window.localStorage.getItem(HINT_KEY) !== "1");
    let cancelled = false;
    void getPermissionStatus("microphone").then((next) => {
      if (!cancelled && (next === "granted" || next === "denied")) hint.current = next;
    });
    return () => {
      cancelled = true;
      stopTracks();
    };
  }, []);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    return bindNoCallout(button);
  }, []);

  useEffect(() => {
    const recording = phase === "recording" || phase === "cancel" || phase === "locked";
    const form = rootRef.current?.closest("form");
    form?.toggleAttribute("data-recording", recording);
    document.body.classList.toggle("chat-recording", recording);
    return () => {
      form?.removeAttribute("data-recording");
      document.body.classList.remove("chat-recording");
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "recording" && phase !== "cancel" && phase !== "locked") return;
    const timer = window.setInterval(() => setElapsed(Date.now() - started.current), 200);
    const wave = window.setInterval(() => {
      const node = analyser.current;
      if (!node) return;
      const data = new Uint8Array(node.fftSize);
      node.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }
      const level = Math.max(8, Math.min(100, Math.round(Math.sqrt(sum / data.length) * 220)));
      barsRef.current = [...barsRef.current.slice(-47), level];
      setBars(barsRef.current);
    }, 100);
    const toPreview = () => endRef.current("preview");
    const onHide = () => {
      if (document.visibilityState === "hidden") toPreview();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", toPreview);
    const tracks = stream.current?.getTracks() ?? [];
    for (const track of tracks) {
      track.addEventListener("mute", toPreview);
      track.addEventListener("ended", toPreview);
    }
    return () => {
      window.clearInterval(timer);
      window.clearInterval(wave);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", toPreview);
      for (const track of tracks) {
        track.removeEventListener("mute", toPreview);
        track.removeEventListener("ended", toPreview);
      }
    };
  }, [phase]);

  function dismissHint() {
    window.localStorage.setItem(HINT_KEY, "1");
    setShowHint(false);
  }

  async function begin(event: PointerEvent<HTMLButtonElement>) {
    if (phase !== "idle") return;
    event.preventDefault();
    dismissHint();
    pressed.current = true;
    onError("");
    const button = event.currentTarget;
    const pointerId = event.pointerId;
    capturePointer(button, pointerId);
    downAt.current = Date.now();
    origin.current = { x: event.clientX, y: event.clientY };
    const token = session.current + 1;
    session.current = token;
    if (!shouldCaptureMedia(hint.current, sessionMediaGranted("microphone"))) {
      setGate("denied");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      markSessionMedia("microphone");
      if (session.current !== token) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      const name = interpretGetUserMedia({ ok: true, fingerDown: true });
      if (name === "drawer" || name === "missing") return;
      const mode = voiceStartMode(Date.now() - downAt.current, pressed.current);
      if (mode === "interrupted") {
        media.getTracks().forEach((track) => track.stop());
        onError(fa.chat.holdAgain);
        return;
      }
      stream.current = media;
      const context = new AudioContext();
      const source = context.createMediaStreamSource(media);
      const node = context.createAnalyser();
      node.fftSize = 256;
      source.connect(node);
      audioCtx.current = context;
      analyser.current = node;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(media, { mimeType: mime }) : new MediaRecorder(media);
      chunks.current = [];
      barsRef.current = [];
      setBars([]);
      rec.ondataavailable = (item) => {
        if (item.data.size > 0) chunks.current.push(item.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const durationMs = Date.now() - started.current;
        const waveform = barsRef.current.slice();
        const next = intent.current;
        stopTracks();
        stopping.current = false;
        recorder.current = null;
        if (next === "discard" || blob.size === 0) {
          setPhase("idle");
          setBars([]);
          return;
        }
        const file = new File([blob], `voice.${extensionFor(type)}`, { type });
        if (next === "send") {
          if (durationMs < 500) onError(fa.chat.voiceTooShort);
          else onRecorded(file);
          setPhase("idle");
          setBars([]);
          return;
        }
        setPreview({ url: URL.createObjectURL(blob), file, durationMs, waveform });
        setPhase("preview");
      };
      recorder.current = rec;
      holding.current = true;
      stopping.current = false;
      started.current = Date.now();
      gesture.current = mode === "locked" ? "lock" : "recording";
      rec.start();
      setPhase(mode === "locked" ? "locked" : "recording");
      setElapsed(0);
      limit.current = window.setTimeout(() => {
        endRecording(gesture.current === "lock" ? "preview" : "send");
      }, CHAT_VOICE_MAX_MS);
    } catch (error) {
      stopTracks();
      const errorName = error instanceof Error ? error.name : "";
      const outcome = interpretGetUserMedia({ ok: false, errorName, fingerDown: pressed.current });
      if (outcome === "drawer") {
        hint.current = "denied";
        setGate("denied");
      } else if (outcome === "missing") {
        onError(fa.chat.micMissing);
      } else {
        onError(fa.common.error);
      }
    }
  }

  function seek(ratio: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function dropPreview() {
    clearPreview(preview);
    setPhase("idle");
    setBars([]);
  }

  function sendPreview() {
    if (!preview) return;
    onRecorded(preview.file);
    clearPreview(preview);
    setPhase("idle");
    setBars([]);
  }

  const recording = phase === "recording" || phase === "cancel" || phase === "locked";

  return (
    <div className="contents" ref={rootRef}>
      {showHint && phase === "idle" ? (
        <p className="bg-popover text-popover-foreground pointer-events-none absolute bottom-14 end-3 z-10 w-56 rounded-md border px-2 py-1 text-xs leading-[1.5] shadow">
          {fa.chat.voiceHint}
        </p>
      ) : null}
      {recording ? (
        <div className="bg-background absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t px-3 py-2">
          <span className="w-12 shrink-0 text-sm tabular-nums">{clock(elapsed)}</span>
          <Wave bars={bars} />
          {phase === "locked" ? (
            <>
              <button type="button" className="inline-flex size-10 items-center justify-center" aria-label={fa.chat.voiceStop} onClick={() => endRecording("preview")}>
                <Square className="size-5" />
              </button>
              <button type="button" className="inline-flex size-10 items-center justify-center" aria-label={fa.chat.voiceDelete} onClick={() => endRecording("discard")}>
                <Trash2 className="size-5" />
              </button>
            </>
          ) : (
            <span className="text-muted-foreground shrink-0 text-xs">
              {phase === "cancel" ? fa.chat.voiceCancel : fa.chat.slideToCancel}
            </span>
          )}
        </div>
      ) : null}
      {phase === "preview" && preview ? (
        <div className="bg-background absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t px-3 py-2" aria-label={fa.chat.voicePreview}>
          <audio
            ref={audioRef}
            src={preview.url}
            preload="auto"
            onTimeUpdate={(event) => {
              const audio = event.currentTarget;
              if (audio.duration) setProgress(audio.currentTime / audio.duration);
            }}
            onEnded={() => {
              setPlaying(false);
              setProgress(0);
            }}
          />
          <button type="button" className="inline-flex size-10 items-center justify-center" aria-label={fa.chat.voicePlay} onClick={() => void togglePlay()}>
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <Wave bars={preview.waveform} progress={progress} onSeek={seek} />
          <span className="w-12 shrink-0 text-xs tabular-nums">{clock(preview.durationMs)}</span>
          <button type="button" className="inline-flex size-10 items-center justify-center" aria-label={fa.chat.voiceDelete} onClick={dropPreview}>
            <Trash2 className="size-5" />
          </button>
          <button type="button" className="bg-primary text-primary-foreground inline-flex size-10 items-center justify-center rounded-full" aria-label={fa.chat.send} onClick={sendPreview}>
            <Send className="size-5" />
          </button>
        </div>
      ) : null}
      {phase !== "preview" ? (
        <button
          type="button"
          ref={buttonRef}
          className="chat-hold border-input inline-flex size-11 shrink-0 items-center justify-center rounded-md border md:size-10"
          aria-label={phase === "locked" ? fa.chat.voiceLocked : fa.chat.holdToRecord}
          onPointerDown={(event) => void begin(event)}
          onPointerMove={(event) => {
            if (!holding.current || gesture.current === "lock") return;
            const next = voiceGesture(event.clientX - origin.current.x, event.clientY - origin.current.y);
            gesture.current = next;
            setPhase(next === "lock" ? "locked" : next);
            setElapsed(Date.now() - started.current);
          }}
          onPointerUp={() => {
            pressed.current = false;
            if (!holding.current || gesture.current === "lock") return;
            endRecording(gesture.current === "cancel" ? "discard" : "send");
          }}
          onPointerCancel={() => {
            pressed.current = false;
            if (!holding.current || gesture.current === "lock") return;
            endRecording("preview");
          }}
        >
          <Mic className="size-5" />
        </button>
      ) : null}
      <MediaPermissionDrawer
        kind="microphone"
        status={gate ?? "prompt"}
        ios={ios}
        open={gate !== null}
        onOpenChange={(next) => {
          if (!next) setGate(null);
        }}
        onResolved={(next) => {
          if (next === "granted") hint.current = "granted";
          if (next === "denied") hint.current = "denied";
          setGate(next === "granted" ? null : next);
        }}
      />
    </div>
  );
}

"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fa } from "@/lib/i18n/fa";
import type { Priority } from "@/db/schema";
import { nudgePriority, quadrantAt } from "@/lib/tasks/priority";
import { cn } from "@/lib/utils";

const CELLS: Array<{ id: Priority; className: string }> = [
  { id: "SCHEDULE", className: "bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100" },
  { id: "DO", className: "bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-100" },
  { id: "ELIMINATE", className: "bg-muted text-muted-foreground" },
  { id: "DELEGATE", className: "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100" },
];

const HANDLE: Record<Priority, { x: number; y: number }> = {
  SCHEDULE: { x: 25, y: 25 },
  DO: { x: 75, y: 25 },
  ELIMINATE: { x: 25, y: 75 },
  DELEGATE: { x: 75, y: 75 },
};

type Props = {
  value: Priority;
  onChange: (next: Priority) => void;
  disabled?: boolean;
};

export function EisenhowerMatrix({ value, onChange, disabled = false }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<Priority | null>(null);
  const shown = hover ?? value;
  const handle = dragPoint ?? HANDLE[value];

  function read(event: { clientX: number; clientY: number }) {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
    return {
      quadrant: quadrantAt(x, y, rect.width, rect.height),
      point: {
        x: rect.width === 0 ? 50 : (x / rect.width) * 100,
        y: rect.height === 0 ? 50 : (y / rect.height) * 100,
      },
    };
  }

  function begin(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    const next = read(event);
    if (!next) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragPoint(next.point);
    setHover(next.quadrant);
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const next = read(event);
    if (!next) return;
    setDragPoint(next.point);
    setHover(next.quadrant);
  }

  function finish(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const next = read(event);
    setDragPoint(null);
    setHover(null);
    if (next) onChange(next.quadrant);
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1" dir="ltr">
        <p className="text-muted-foreground text-center text-xs font-medium">{fa.eisenhower.important}</p>
        <div
          ref={boardRef}
          role="radiogroup"
          aria-label={fa.auditFields.priority}
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "relative grid aspect-[5/3] w-full grid-cols-2 grid-rows-2 overflow-hidden rounded-xl border select-none",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing",
          )}
          style={{ touchAction: "none" }}
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={() => {
            draggingRef.current = false;
            setDragPoint(null);
            setHover(null);
          }}
          onKeyDown={(event) => {
            if (disabled) return;
            const next = nudgePriority(value, event.key);
            if (next === value) return;
            event.preventDefault();
            onChange(next);
          }}
        >
          {CELLS.map((cell) => (
            <div
              key={cell.id}
              role="radio"
              aria-checked={shown === cell.id}
              className={cn(
                "flex flex-col items-center justify-center gap-1 border p-3 text-center",
                cell.className,
                shown === cell.id && "ring-primary ring-2 ring-inset",
              )}
            >
              <span className="text-sm font-semibold">{fa.eisenhower.cells[cell.id].title}</span>
              <span className="text-[11px] opacity-80">{fa.eisenhower.cells[cell.id].detail}</span>
            </div>
          ))}
          <span
            aria-hidden
            className="bg-foreground pointer-events-none absolute size-6 rounded-full border-2 border-white shadow-md"
            style={{
              left: `${handle.x}%`,
              top: `${handle.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
        <div className="text-muted-foreground grid grid-cols-2 text-center text-xs font-medium">
          <span>{fa.eisenhower.notUrgent}</span>
          <span>{fa.eisenhower.urgent}</span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{fa.eisenhower.hint}</p>
    </div>
  );
}

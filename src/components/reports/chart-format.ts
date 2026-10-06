import { toFaDigits } from "@/lib/utils";

export function faNum(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return toFaDigits(v);
}

export function faPercent(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${toFaDigits(v)}٪`;
}

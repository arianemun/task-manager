const SENSITIVE_KEY = /password|secret|token/i;
const SENSITIVE_EXACT = new Set([
  "p256dh",
  "auth",
  "endpoint",
  "sessionversion",
  "generatedpassword",
]);

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key) || SENSITIVE_EXACT.has(key.toLowerCase());
}

function canonicalize(value: unknown): unknown {
  if (value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalize(item));
    if (
      items.every(
        (item) =>
          item === null ||
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean",
      )
    ) {
      return [...items].sort((a, b) =>
        String(a).localeCompare(String(b), "en"),
      );
    }
    return items;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (isSensitiveKey(key)) continue;
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: readonly (keyof T & string)[],
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    if (isSensitiveKey(field)) continue;
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (JSON.stringify(canonicalize(from)) === JSON.stringify(canonicalize(to))) {
      continue;
    }
    diff[field] = { from, to };
  }
  return diff;
}

export function publicSnapshot<T extends Record<string, unknown>>(
  record: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveKey(key)) continue;
    out[key] = value ?? null;
  }
  return out;
}

export function isChangeValue(
  value: unknown,
): value is { from: unknown; to: unknown } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value as object);
  return keys.length === 2 && keys.includes("from") && keys.includes("to");
}

export type AuditMetaView = {
  changes: { field: string; from: unknown; to: unknown }[];
  snapshot: { field: string; value: unknown }[];
  extra: Record<string, unknown> | null;
  raw: string | null;
};

export function viewAuditMeta(meta: unknown): AuditMetaView {
  if (meta == null) {
    return { changes: [], snapshot: [], extra: null, raw: null };
  }
  if (typeof meta !== "object" || Array.isArray(meta)) {
    return {
      changes: [],
      snapshot: [],
      extra: null,
      raw: typeof meta === "string" ? meta : JSON.stringify(meta, null, 2),
    };
  }
  const obj = meta as Record<string, unknown>;
  const changes: AuditMetaView["changes"] = [];
  const snapshot: AuditMetaView["snapshot"] = [];
  const extra: Record<string, unknown> = {};

  if (obj.snapshot && typeof obj.snapshot === "object" && !Array.isArray(obj.snapshot)) {
    for (const [field, value] of Object.entries(obj.snapshot as Record<string, unknown>)) {
      if (isSensitiveKey(field)) continue;
      snapshot.push({ field, value });
    }
  }

  for (const [field, value] of Object.entries(obj)) {
    if (field === "snapshot" || isSensitiveKey(field)) continue;
    if (isChangeValue(value)) {
      changes.push({ field, from: value.from, to: value.to });
    } else {
      extra[field] = value;
    }
  }

  return {
    changes,
    snapshot,
    extra: Object.keys(extra).length ? extra : null,
    raw: null,
  };
}

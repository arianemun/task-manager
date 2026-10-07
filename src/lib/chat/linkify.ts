export type TextPart = { type: "text" | "link"; value: string };

const URL_RE = /https?:\/\/[^\s]+/g;

export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: "text", value: text.slice(last, index) });
    const raw = match[0].replace(/[),.;]+$/g, "");
    parts.push({ type: "link", value: raw });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

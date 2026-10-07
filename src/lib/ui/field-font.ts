import fs from "node:fs";
import path from "node:path";

const FIELD_TAG =
  /<(input|textarea|select|CommandPrimitive\.Input)\b([^>]*)>/g;

function isAllowedSmallFont(token: string): boolean {
  return /^(md|lg|xl|2xl):/.test(token);
}

export function smallFieldFontTokens(className: string): string[] {
  return className.split(/\s+/).filter((token) => {
    if (!/text-(xs|sm)\b/.test(token)) return false;
    return !isAllowedSmallFont(token);
  });
}

function classStrings(tag: string): string[] {
  return [...tag.matchAll(/"([^"]*)"/g)]
    .map((match) => match[1])
    .filter((value) => value.includes("text-"));
}

export function findSmallFieldFonts(root: string): string[] {
  const problems: string[] = [];

  function walk(dir: string) {
    for (const name of fs.readdirSync(dir)) {
      if (name === "node_modules" || name === ".next") continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith(".tsx")) continue;
      const source = fs.readFileSync(full, "utf8");
      for (const match of source.matchAll(FIELD_TAG)) {
        const tag = match[0];
        if (/\btype\s*=\s*"hidden"/.test(tag) || tag.includes("sr-only")) continue;
        for (const className of classStrings(tag)) {
          for (const token of smallFieldFontTokens(className)) {
            problems.push(`${path.relative(root, full)}: ${token}`);
          }
        }
      }
    }
  }

  walk(path.join(root, "src"));
  return problems;
}

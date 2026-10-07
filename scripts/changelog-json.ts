import fs from "node:fs";
import path from "node:path";
import { parseChangelog } from "../src/lib/release/changelog";

const root = process.cwd();
const markdown = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const releases = parseChangelog(markdown);
const outDir = path.join(root, "src/generated");
fs.mkdirSync(outDir, { recursive: true });
const body = `/* این فایل از CHANGELOG.md ساخته می‌شود. دستی ویرایش نکنید. */
export const changelog = ${JSON.stringify(releases, null, 2)} as const;
`;
fs.writeFileSync(path.join(outDir, "changelog.ts"), body);

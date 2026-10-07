/**
 * نسخه را طبق SemVer بالا می‌برد، بخش «منتشرنشده» را با تاریخ شمسی
 * به نسخه جدید منتقل می‌کند، commit و tag annotated می‌سازد. push نمی‌کند.
 *
 *   npm run release -- patch|minor|major
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { format } from "date-fns-jalali";
import { bumpVersion } from "../src/lib/release/changelog";
import { toFaDigits } from "../src/lib/utils";

const level = process.argv[2];
if (level !== "patch" && level !== "minor" && level !== "major") {
  console.error("استفاده: npm run release -- <patch|minor|major>");
  process.exit(1);
}

const root = process.cwd();
const pkgPath = path.join(root, "package.json");
const changelogPath = path.join(root, "CHANGELOG.md");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version: string };
const nextVersion = bumpVersion(pkg.version, level);
const markdown = fs.readFileSync(changelogPath, "utf8");
const marker = "## [منتشرنشده]";
const start = markdown.indexOf(marker);
if (start < 0) {
  console.error("بخش ## [منتشرنشده] در CHANGELOG.md نیست.");
  process.exit(1);
}
const after = markdown.slice(start + marker.length);
const nextHeading = after.search(/\n## \[/);
const body = (nextHeading === -1 ? after : after.slice(0, nextHeading)).replace(
  /^\n+/,
  "\n",
);
const rest = nextHeading === -1 ? "" : after.slice(nextHeading);
if (!body.trim()) {
  console.error("بخش منتشرنشده خالی است.");
  process.exit(1);
}

const jalali = toFaDigits(format(new Date(), "yyyy/MM/dd"));
const released = `## [${nextVersion}] - ${jalali}${body.endsWith("\n") ? body : `${body}\n`}`;
const nextMarkdown = `${markdown.slice(0, start)}${marker}\n\n${released}${rest.replace(/^\n/, "")}`;
pkg.version = nextVersion;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
fs.writeFileSync(changelogPath, nextMarkdown.endsWith("\n") ? nextMarkdown : `${nextMarkdown}\n`);

execFileSync("npx", ["tsx", "scripts/changelog-json.ts"], { cwd: root, stdio: "inherit" });

const status = execFileSync("git", ["status", "--porcelain", "--", "package.json", "CHANGELOG.md", "src/generated/changelog.ts"], {
  cwd: root,
  encoding: "utf8",
});
if (!status.trim()) {
  console.error("تغییری برای commit نیست.");
  process.exit(1);
}

const authorName = execFileSync("git", ["log", "-1", "--format=%an"], { cwd: root, encoding: "utf8" }).trim();
const authorEmail = execFileSync("git", ["log", "-1", "--format=%ae"], { cwd: root, encoding: "utf8" }).trim();
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: authorName,
  GIT_AUTHOR_EMAIL: authorEmail,
  GIT_COMMITTER_NAME: authorName,
  GIT_COMMITTER_EMAIL: authorEmail,
};
execFileSync("git", ["add", "package.json", "CHANGELOG.md", "src/generated/changelog.ts"], { cwd: root });
execFileSync(
  "git",
  ["commit", "-m", `Bump version to ${nextVersion}.`],
  { cwd: root, env },
);
execFileSync(
  "git",
  ["tag", "-a", `v${nextVersion}`, "-m", `نسخه ${nextVersion}`],
  { cwd: root, env },
);
console.log(`نسخه ${nextVersion} commit و tag شد. push انجام نشد.`);

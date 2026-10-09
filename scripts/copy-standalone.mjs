/**
 * پس از next build (standalone): کپی public و .next/static کنار server.js
 * بدون این کار CSS/فونت در production لود نمی‌شوند.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn("رد شد (نیست):", src);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log("✓ کپی", src, "→", dest);
}

if (!fs.existsSync(standalone)) {
  console.error("پوشه .next/standalone یافت نشد. ابتدا npm run build را اجرا کنید.");
  process.exit(1);
}

copyDir(staticSrc, path.join(standalone, ".next", "static"));
copyDir(publicSrc, path.join(standalone, "public"));

const swFile = path.join(standalone, "public", "sw.js");
if (fs.existsSync(swFile)) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const stamp = `${pkg.version}-${Date.now()}`;
  const source = fs.readFileSync(swFile, "utf8");
  fs.writeFileSync(swFile, source.replace(/const SW_VERSION = "[^"]*";/, `const SW_VERSION = "${stamp}";`));
  console.log("✓ service worker", stamp);
}

for (const name of [".env", ".env.production", ".env.local"]) {
  const src = path.join(root, name);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(standalone, name));
  console.log("✓ کپی", src, "→", path.join(standalone, name));
}

console.log("standalone آماده است.");

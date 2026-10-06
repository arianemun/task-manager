import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";

if (process.env.NODE_ENV === "production") {
  console.error("❌ db:reset در NODE_ENV=production مجاز نیست.");
  process.exit(1);
}

const dataDir = path.join(process.cwd(), "data");
const dbFile = path.join(dataDir, "app.db");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.join(process.cwd(), "uploads"), { recursive: true });

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy wait */
  }
}

function tryUnlink(file) {
  for (let i = 0; i < 5; i++) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return true;
    } catch {
      sleep(200);
    }
  }
  return !fs.existsSync(file);
}

/** حذف کامل schema تا migrate از صفر اعمال شود */
function dropAllTables() {
  if (!fs.existsSync(dbFile)) return;
  const sqlite = new Database(dbFile);
  try {
    sqlite.pragma("foreign_keys = OFF");
    const tables = sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      )
      .all();
    for (const { name } of tables) {
      sqlite.exec(`DROP TABLE IF EXISTS "${name}"`);
    }
    sqlite.pragma("foreign_keys = ON");
    console.log("✓ تمام جداول drop شدند");
  } finally {
    sqlite.close();
  }
}

let removed = true;
for (const name of ["app.db", "app.db-wal", "app.db-shm"]) {
  const file = path.join(dataDir, name);
  if (fs.existsSync(file) && !tryUnlink(file)) {
    removed = false;
  }
}

if (!removed) {
  console.log("فایل DB قفل است — drop جداول و migrate مجدد…");
  dropAllTables();
}

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`دستور با کد ${result.status} متوقف شد`);
    process.exit(result.status ?? 1);
  }
}

run("npx", ["drizzle-kit", "migrate"]);
run("npx", ["tsx", "src/db/seed.ts"]);
console.log("✅ db:reset تمام شد");

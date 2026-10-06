import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execSync } from "node:child_process";

const sessions = JSON.parse(fs.readFileSync("scripts/sessions.json", "utf8"));
fs.mkdirSync("docs/lighthouse", { recursive: true });

const require = createRequire(import.meta.url);
try {
  require.resolve("lighthouse");
  require.resolve("chrome-launcher");
} catch {
  execSync("npm install --no-save lighthouse chrome-launcher", {
    stdio: "inherit",
  });
}
const chromeLauncher = require("chrome-launcher");
const lighthousePath = require.resolve("lighthouse");
const { default: lighthouse } = await import(pathToFileURL(lighthousePath).href);

const jobs = [
  {
    url: "http://127.0.0.1:3000/me",
    cookie: sessions.staffCookie,
    out: "docs/lighthouse/me-mobile.json",
  },
  {
    url: "http://127.0.0.1:3000/admin",
    cookie: sessions.adminCookie,
    out: "docs/lighthouse/admin-mobile.json",
  },
  {
    url: "http://127.0.0.1:3000/admin/reports",
    cookie: sessions.adminCookie,
    out: "docs/lighthouse/reports-mobile.json",
  },
];

const chrome = await chromeLauncher.launch({
  chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
});

try {
  for (const job of jobs) {
    console.log("Running", job.url);
    const result = await lighthouse(job.url, {
      port: chrome.port,
      output: "json",
      onlyCategories: ["accessibility", "best-practices", "performance"],
      formFactor: "mobile",
      screenEmulation: {
        mobile: true,
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        disabled: false,
      },
      extraHeaders: { Cookie: job.cookie },
    });
    fs.writeFileSync(job.out, result.report);
    const lhr = result.lhr;
    const scores = Object.fromEntries(
      Object.entries(lhr.categories).map(([k, v]) => [
        k,
        Math.round((v.score || 0) * 100),
      ]),
    );
    const consoleErr = lhr.audits["errors-in-console"]?.details?.items ?? [];
    console.log(
      JSON.stringify(
        {
          out: job.out,
          finalUrl: lhr.finalUrl,
          scores,
          runtimeError: lhr.runtimeError ?? null,
          consoleErr: consoleErr.slice(0, 8),
        },
        null,
        2,
      ),
    );
  }
} finally {
  await chrome.kill();
}

import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const uploadsDir = path.join(process.cwd(), "uploads");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const gitkeep = path.join(dataDir, ".gitkeep");
if (!fs.existsSync(gitkeep)) {
  fs.writeFileSync(gitkeep, "");
}

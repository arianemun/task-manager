import "dotenv/config";
import { SignJWT } from "jose";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";

const SESSION_COOKIE_NAME = "tm_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error("SESSION_SECRET missing");

const db = new Database("./data/app.db");
const admin = db
  .prepare(
    "SELECT id, username, password_hash, session_version FROM users WHERE username = ?",
  )
  .get("admin");
const staff = db
  .prepare(
    "SELECT id, username, password_hash, session_version FROM users WHERE username = ?",
  )
  .get("staff1");

const ok = await bcrypt.compare("Admin@123456", admin.password_hash);
console.log("password verify", ok, "adminId", admin.id);

async function token(user) {
  return new SignJWT({
    userId: user.id,
    sessionVersion: user.session_version,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
}

const adminToken = await token(admin);
const staffToken = await token(staff);
fs.writeFileSync(
  "scripts/sessions.json",
  JSON.stringify(
    {
      adminCookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      staffCookie: `${SESSION_COOKIE_NAME}=${staffToken}`,
    },
    null,
    2,
  ),
);
console.log("wrote scripts/sessions.json");
db.close();

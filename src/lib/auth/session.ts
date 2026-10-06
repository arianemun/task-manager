import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "./constants";
import { isCookieSecure } from "./cookie-secure";

export type SessionPayload = {
  userId: number;
  sessionVersion: number;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET باید در محیط تنظیم شود (حداقل ۱۶ کاراکتر).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  userId: number,
  sessionVersion: number,
): Promise<string> {
  return new SignJWT({
    userId,
    sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const userId = Number(payload.userId);
    const sessionVersion = Number(payload.sessionVersion);
    if (!Number.isInteger(userId) || !Number.isInteger(sessionVersion)) {
      return null;
    }
    return { userId, sessionVersion };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isCookieSecure(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isCookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export async function readSessionCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const token = await readSessionCookie();
  if (!token) return null;
  return verifySessionToken(token);
}

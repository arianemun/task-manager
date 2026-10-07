import { SignJWT, jwtVerify } from "jose";
import { SESSION_MAX_AGE_SECONDS } from "./constants";

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

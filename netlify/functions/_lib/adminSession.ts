import crypto from "node:crypto";
import type { HandlerEvent } from "@netlify/functions";

const COOKIE_NAME = "raffle_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

const getSecret = () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is required.");
  }
  return secret;
};

const base64UrlEncode = (value: string) => Buffer.from(value).toString("base64url");
const base64UrlDecode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const sign = (value: string): string =>
  crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");

export const createSessionToken = () => {
  const expiresAt = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${expiresAt}.${nonce}`;
  const signature = sign(payload);
  return base64UrlEncode(`${payload}.${signature}`);
};

export const verifySessionToken = (token: string | null): boolean => {
  if (!token) return false;

  try {
    const decoded = base64UrlDecode(token);
    const parts = decoded.split(".");
    if (parts.length !== 3) return false;

    const [expires, nonce, signature] = parts;
    const payload = `${expires}.${nonce}`;

    const expected = sign(payload);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return false;
    }

    return Number(expires) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

export const cookieFromToken = (token: string) =>
  `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${MAX_AGE_SECONDS}`;

export const clearCookie = () =>
  `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;

export const getCookieToken = (event: HandlerEvent): string | null => {
  const raw = event.headers.cookie || event.headers.Cookie;
  if (!raw) return null;

  const pairs = raw.split(";").map((entry) => entry.trim());
  const match = pairs.find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;

  return match.slice(COOKIE_NAME.length + 1);
};

import { createHmac, timingSafeEqual } from "node:crypto";

// Signed session cookie. The password and signing secret live only in
// Netlify environment variables (APP_PASSWORD, SESSION_SECRET).

export const COOKIE_NAME = "oodc_session";
const SESSION_HOURS = 12;

const secret = () => Netlify.env.get("SESSION_SECRET") ?? "";

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

export const checkPassword = (attempt: string) => {
  const expected = Netlify.env.get("APP_PASSWORD");
  if (!expected || !secret()) return false;
  // Compare HMACs so the comparison is constant-time regardless of length.
  return safeEqual(sign(`pw:${attempt.trim()}`), sign(`pw:${expected}`));
};

export const createSessionCookie = () => {
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  const value = `${expires}.${sign(`session:${expires}`)}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
};

export const clearSessionCookie = () =>
  `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export const hasValidSession = (req: Request) => {
  if (!secret()) return false;
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [expires, signature] = match[1].split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return safeEqual(signature, sign(`session:${expires}`));
};

import "server-only";
import { createHash, randomInt } from "crypto";

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const OTP_MAX_ATTEMPTS = 5;

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

export function hashOtp(code: string, email: string): string {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHash("sha256").update(`${secret}:${email.toLowerCase()}:${code}`).digest("hex");
}

export function otpExpiry() {
  return new Date(Date.now() + OTP_TTL_MS);
}

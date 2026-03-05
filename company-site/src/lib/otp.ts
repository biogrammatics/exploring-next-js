import crypto from "crypto";

/**
 * Generate a random 6-digit OTP code.
 */
export function generateOtpCode(): string {
  // Generate a number between 100000 and 999999
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

/**
 * Hash an OTP code using SHA-256.
 * We use SHA-256 (not bcrypt) because OTP codes are:
 * - Short-lived (10 minutes)
 * - Single-use
 * - Only 6 digits (brute-forceable regardless of hash algorithm)
 * The short expiry is the real security, not the hash strength.
 */
export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Verify an OTP code against its hash.
 */
export function verifyOtpCode(code: string, hash: string): boolean {
  const codeHash = hashOtpCode(code);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(hash));
  } catch {
    return false;
  }
}

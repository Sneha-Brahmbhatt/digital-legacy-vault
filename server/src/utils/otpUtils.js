import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const OTP_LENGTH = 6;
const OTP_BCRYPT_ROUNDS = 10;
// OTP is valid for 15 minutes after generation
const OTP_TTL_MINUTES = 15;

/**
 * Generates a cryptographically random numeric OTP.
 * @returns {{ otp: string, expiresAt: Date }}
 */
export function generateOtp() {
  // Use crypto.randomInt for unbiased uniform distribution
  const otp = crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  return { otp, expiresAt };
}

/**
 * Hashes an OTP for safe storage.
 * @param {string} otp
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashOtp(otp) {
  return bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);
}

/**
 * Verifies a candidate OTP against a stored bcrypt hash.
 * Always runs in constant time via bcrypt.compare.
 * @param {string} candidate - plaintext OTP from user
 * @param {string} hash - stored bcrypt hash
 * @returns {Promise<boolean>}
 */
export async function verifyOtp(candidate, hash) {
  if (!candidate || !hash) return false;
  return bcrypt.compare(candidate, hash);
}

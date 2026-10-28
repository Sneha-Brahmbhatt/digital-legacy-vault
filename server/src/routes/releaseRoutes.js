import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import {
  initiateRelease,
  verifyOtpAndStartGracePeriod,
  getActiveReleaseStatus,
  cancelReleaseRequest,
  getReleasedVault,
  getReleaseHistory,
} from '../controllers/releaseController.js';

const router = express.Router();

// All release routes require authentication
router.use(protect);

/**
 * POST /api/release/initiate
 * Trustee only — begin a release request and receive OTP
 */
router.post('/initiate', authorize(ROLES.TRUSTEE, ROLES.BOTH), initiateRelease);

/**
 * POST /api/release/verify-otp
 * Trustee only — submit OTP to advance to pending + start grace period
 */
router.post('/verify-otp', authorize(ROLES.TRUSTEE, ROLES.BOTH), verifyOtpAndStartGracePeriod);

/**
 * GET /api/release/active-status
 * Any authenticated user — see their active request (owner or trustee perspective)
 */
router.get('/active-status', getActiveReleaseStatus);

/**
 * POST /api/release/cancel
 * Owner only — veto a pending release within the grace period
 */
router.post('/cancel', authorize(ROLES.OWNER, ROLES.BOTH), cancelReleaseRequest);

/**
 * GET /api/release/released-vault
 * Trustee only — retrieve wrapped keys + ciphertext after release
 */
router.get('/released-vault', authorize(ROLES.TRUSTEE, ROLES.BOTH), getReleasedVault);

/**
 * GET /api/release/history
 * Owner only — read past (terminal-state) requests
 */
router.get('/history', authorize(ROLES.OWNER, ROLES.BOTH), getReleaseHistory);

export default router;

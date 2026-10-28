/**
 * Release Controller — implements the canonical release state machine:
 *
 *   no request
 *     → [trustee POST /initiate]          → awaiting_verification
 *     → [trustee POST /verify-otp]        → pending  (grace period starts, owner notified)
 *     → [owner   POST /cancel]            → cancelled
 *     → [expiry worker auto-executes]     → released
 *
 * Security properties:
 *   - Only an authorized trustee for THIS owner can initiate
 *   - Duplicate active requests are blocked (one active request per owner)
 *   - OTP is bcrypt-hashed before storage; plaintext never persisted
 *   - Release cannot happen before gracePeriodExpiresAt
 *   - Owner can cancel at any point while status === 'pending'
 *   - Server never sends plaintext vault content; trustee fetches wrapped DEKs only
 */

import ReleaseRequest from '../models/ReleaseRequest.js';
import TrusteeAssignment from '../models/TrusteeAssignment.js';
import User from '../models/User.js';
import { RELEASE_STATUS, AUDIT_ACTIONS, TRUSTEE_STATUS } from '../config/constants.js';
import { generateOtp, hashOtp, verifyOtp } from '../utils/otpUtils.js';
import { recordAuditEvent } from '../services/auditService.js';
import {
  sendTrusteeOtpEmail,
  sendOwnerReleaseNotification,
  sendOwnerCancellationConfirmation,
  sendReleaseExecutedNotifications,
} from '../services/notificationService.js';
import { ENV } from '../config/env.js';

/** Returns grace period expiry Date from now */
function computeGracePeriodExpiry() {
  if (ENV.GRACE_PERIOD_TEST_MINUTES > 0) {
    return new Date(Date.now() + ENV.GRACE_PERIOD_TEST_MINUTES * 60 * 1000);
  }
  return new Date(Date.now() + ENV.DEFAULT_GRACE_PERIOD_HOURS * 60 * 60 * 1000);
}

// ── POST /api/release/initiate ─────────────────────────────────────────────

/**
 * Trustee calls this to start the release workflow.
 * Body: { ownerId }
 *
 * Validates:
 *   1. Trustee has an active assignment for this owner
 *   2. No active (awaiting_verification or pending) request already exists
 *
 * Creates a ReleaseRequest in `awaiting_verification` and emails the OTP to the trustee.
 */
export const initiateRelease = async (req, res, next) => {
  try {
    const trusteeId = req.user._id;
    const { ownerId } = req.body;

    if (!ownerId) {
      return res.status(400).json({ success: false, message: 'ownerId is required.' });
    }

    // 1. Verify an active trustee assignment exists for this trustee ↔ owner pair
    const assignment = await TrusteeAssignment.findOne({
      ownerId,
      $or: [{ trusteeId }, { trusteeEmail: req.user.email }],
      status: TRUSTEE_STATUS.ACTIVE,
    });

    if (!assignment) {
      await recordAuditEvent({
        actorId: trusteeId,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS_ATTEMPT,
        targetId: ownerId,
        targetType: 'User',
        status: 'failure',
        ipAddress: req.ip,
        metadata: { reason: 'No active trustee assignment found' },
      });
      return res.status(403).json({
        success: false,
        message: 'You are not an authorized trustee for this vault owner.',
      });
    }

    // 2. Block duplicate active requests
    const existingActive = await ReleaseRequest.findOne({
      ownerId,
      status: { $in: [RELEASE_STATUS.AWAITING_VERIFICATION, RELEASE_STATUS.PENDING] },
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: 'An active release request already exists for this vault owner.',
        data: { status: existingActive.status, requestId: existingActive._id },
      });
    }

    // 3. Generate OTP
    const { otp, expiresAt: otpExpiresAt } = generateOtp();
    const verificationOtpHash = await hashOtp(otp);

    // 4. Create the release request
    const releaseRequest = await ReleaseRequest.create({
      ownerId,
      trusteeId,
      trusteeAssignmentId: assignment._id,
      status: RELEASE_STATUS.AWAITING_VERIFICATION,
      verificationOtpHash,
      otpExpiresAt,
    });

    // 5. Email the OTP to the trustee (non-blocking error)
    const owner = await User.findById(ownerId).select('name email').lean();
    await sendTrusteeOtpEmail({
      trusteeEmail: req.user.email,
      trusteeName: req.user.name,
      otp, // sent to trustee only; never stored in plaintext
      ownerName: owner?.name || 'the vault owner',
      expiresAt: otpExpiresAt,
    });

    await recordAuditEvent({
      actorId: trusteeId,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.RELEASE_INITIATED,
      targetId: releaseRequest._id,
      targetType: 'ReleaseRequest',
      status: 'success',
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Release request created. Check your email for the verification code.',
      data: {
        requestId: releaseRequest._id,
        otpExpiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/release/verify-otp ──────────────────────────────────────────

/**
 * Trustee submits the OTP to advance the request to `pending`.
 * Body: { requestId, otp }
 *
 * On success:
 *   - Transitions to `pending`
 *   - Sets gracePeriodExpiresAt
 *   - Clears OTP hash (single-use)
 *   - Emails owner with grace period countdown and cancel link
 */
export const verifyOtpAndStartGracePeriod = async (req, res, next) => {
  try {
    const trusteeId = req.user._id;
    const { requestId, otp } = req.body;

    if (!requestId || !otp) {
      return res.status(400).json({ success: false, message: 'requestId and otp are required.' });
    }

    const releaseRequest = await ReleaseRequest.findOne({
      _id: requestId,
      trusteeId,
      status: RELEASE_STATUS.AWAITING_VERIFICATION,
    });

    if (!releaseRequest) {
      return res.status(404).json({
        success: false,
        message: 'Release request not found or not in awaiting_verification state.',
      });
    }

    // Check OTP expiry
    if (new Date() > new Date(releaseRequest.otpExpiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please initiate a new release request.',
      });
    }

    // Verify OTP (constant-time comparison via bcrypt)
    const valid = await verifyOtp(otp, releaseRequest.verificationOtpHash);
    if (!valid) {
      await recordAuditEvent({
        actorId: trusteeId,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS_ATTEMPT,
        targetId: releaseRequest._id,
        targetType: 'ReleaseRequest',
        status: 'failure',
        ipAddress: req.ip,
        metadata: { reason: 'Invalid OTP' },
      });
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    // Advance state — clear OTP hash (single-use)
    const gracePeriodExpiresAt = computeGracePeriodExpiry();
    releaseRequest.status = RELEASE_STATUS.PENDING;
    releaseRequest.verificationOtpHash = null;
    releaseRequest.otpExpiresAt = null;
    releaseRequest.gracePeriodExpiresAt = gracePeriodExpiresAt;
    await releaseRequest.save();

    // Notify owner immediately
    const [owner, trustee] = await Promise.all([
      User.findById(releaseRequest.ownerId).select('name email').lean(),
      User.findById(trusteeId).select('name email').lean(),
    ]);

    const cancelUrl = `${ENV.CLIENT_URL}/release?action=cancel&requestId=${releaseRequest._id}`;

    await sendOwnerReleaseNotification({
      ownerEmail: owner?.email,
      ownerName: owner?.name,
      trusteeName: trustee?.name,
      trusteeEmail: trustee?.email,
      gracePeriodExpiresAt,
      cancelUrl,
    });

    await recordAuditEvent({
      actorId: trusteeId,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.RELEASE_OTP_VERIFIED,
      targetId: releaseRequest._id,
      targetType: 'ReleaseRequest',
      status: 'success',
      ipAddress: req.ip,
      metadata: { gracePeriodExpiresAt },
    });

    return res.status(200).json({
      success: true,
      message: 'Identity verified. Grace period has started. The vault owner has been notified.',
      data: {
        requestId: releaseRequest._id,
        status: RELEASE_STATUS.PENDING,
        gracePeriodExpiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/release/active-status ────────────────────────────────────────

/**
 * Returns the current active release request for the authenticated user.
 * Usable by both owner (to see/cancel) and trustee (to track their request).
 */
export const getActiveReleaseStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find a request where the user is either owner or trustee
    const active = await ReleaseRequest.findOne({
      $or: [{ ownerId: userId }, { trusteeId: userId }],
      status: { $in: [RELEASE_STATUS.AWAITING_VERIFICATION, RELEASE_STATUS.PENDING] },
    })
      .populate('ownerId', 'name email')
      .populate('trusteeId', 'name email')
      .lean();

    if (!active) {
      return res.status(200).json({ success: true, data: null, message: 'No active release request.' });
    }

    return res.status(200).json({ success: true, data: active });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/release/cancel ──────────────────────────────────────────────

/**
 * Owner cancels an active pending release request.
 * Body: { requestId }
 *
 * Allowed only while status === 'pending' AND gracePeriodExpiresAt has not passed.
 */
export const cancelReleaseRequest = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'requestId is required.' });
    }

    // Use findOneAndUpdate for atomic state transition — prevents race with expiry worker
    const updated = await ReleaseRequest.findOneAndUpdate(
      {
        _id: requestId,
        ownerId,
        status: RELEASE_STATUS.PENDING,
        gracePeriodExpiresAt: { $gt: new Date() }, // must still be in grace period
      },
      {
        $set: {
          status: RELEASE_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: ownerId,
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({
        success: false,
        message:
          'Unable to cancel. The request may not exist, does not belong to your account, is not in pending state, or the grace period has already expired.',
      });
    }

    // Confirm cancellation to owner
    await sendOwnerCancellationConfirmation({
      ownerEmail: req.user.email,
      ownerName: req.user.name,
      trusteeEmail: updated.trusteeId?.toString() || 'the trustee',
    });

    await recordAuditEvent({
      actorId: ownerId,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.RELEASE_CANCELLED_BY_OWNER,
      targetId: updated._id,
      targetType: 'ReleaseRequest',
      status: 'success',
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Release request cancelled successfully. Your vault remains secure.',
      data: { requestId: updated._id, status: updated.status, cancelledAt: updated.cancelledAt },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/release/released-vault ──────────────────────────────────────

/**
 * Trustee-only: returns assigned vault items + their wrapped DEKs
 * for a completed (released) request.
 *
 * The server sends ONLY ciphertext and RSA-OAEP-wrapped keys.
 * Plaintext decryption happens entirely in the trustee's browser.
 */
export const getReleasedVault = async (req, res, next) => {
  try {
    const trusteeId = req.user._id;
    const { requestId } = req.query;

    const releaseRequest = await ReleaseRequest.findOne({
      _id: requestId,
      trusteeId,
      status: RELEASE_STATUS.RELEASED,
    }).lean();

    if (!releaseRequest) {
      return res.status(404).json({
        success: false,
        message: 'No released request found for this trustee.',
      });
    }

    // Fetch the trustee assignment with wrapped keys
    const assignment = await TrusteeAssignment.findById(releaseRequest.trusteeAssignmentId)
      .populate({
        path: 'assignedItems.itemId',
        select: 'category encryptedTitle titleIv encryptedContent contentIv encryptedKey keyIv encryptedKeyForOwner fileRef fileIv createdAt',
      })
      .lean();

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Trustee assignment not found.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        releasedAt: releaseRequest.releasedAt,
        items: assignment.assignedItems,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/release/history ──────────────────────────────────────────────

/**
 * Returns past release requests for the authenticated owner (read-only audit view).
 */
export const getReleaseHistory = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const history = await ReleaseRequest.find({
      ownerId,
      status: { $in: [RELEASE_STATUS.CANCELLED, RELEASE_STATUS.RELEASED, RELEASE_STATUS.REJECTED] },
    })
      .populate('trusteeId', 'name email')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

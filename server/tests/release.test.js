/**
 * Release Workflow State Machine Tests
 * Covers FR-5 (Release Workflow) and NFR-2 (No single actor can force premature release).
 *
 * All models are mocked — no real database required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mocks ───────────────────────────────────────────────────────────────
vi.mock('../src/models/ReleaseRequest.js', () => ({
  default: {
    findOne: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
  }
}));

vi.mock('../src/models/TrusteeAssignment.js', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
  }
}));

vi.mock('../src/models/User.js', () => ({
  default: {
    findById: vi.fn(),
  }
}));

vi.mock('../src/utils/otpUtils.js', () => ({
  generateOtp: vi.fn(() => ({ otp: '123456', expiresAt: new Date(Date.now() + 15 * 60 * 1000) })),
  hashOtp: vi.fn(async () => '$2b$10$hashedOtpValue'),
  verifyOtp: vi.fn(async () => true),
}));

vi.mock('../src/services/notificationService.js', () => ({
  sendTrusteeOtpEmail: vi.fn(async () => {}),
  sendOwnerReleaseNotification: vi.fn(async () => {}),
  sendOwnerCancellationConfirmation: vi.fn(async () => {}),
  sendReleaseExecutedNotifications: vi.fn(async () => {}),
}));

vi.mock('../src/services/auditService.js', () => ({
  recordAuditEvent: vi.fn(async () => {}),
}));

import ReleaseRequest from '../src/models/ReleaseRequest.js';
import TrusteeAssignment from '../src/models/TrusteeAssignment.js';
import User from '../src/models/User.js';
import { verifyOtp } from '../src/utils/otpUtils.js';
import { sendTrusteeOtpEmail, sendOwnerReleaseNotification } from '../src/services/notificationService.js';

import {
  initiateRelease,
  verifyOtpAndStartGracePeriod,
  getActiveReleaseStatus,
  cancelReleaseRequest,
  getReleasedVault,
  getReleaseHistory,
} from '../src/controllers/releaseController.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(overrides = {}) {
  return {
    user: { _id: 'trustee-id-001', email: 'trustee@example.com', name: 'Alice Trustee' },
    body: {},
    params: {},
    query: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

function makeRes() {
  const res = { statusCode: 200, data: null };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn((body) => { res.data = body; return res; });
  return res;
}

function makeSaveableDoc(fields = {}) {
  return { save: vi.fn().mockResolvedValue(undefined), ...fields };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Release Workflow State Machine (FR-5, NFR-2)', () => {
  let req, res, next;

  beforeEach(() => {
    req = makeReq();
    res = makeRes();
    next = vi.fn();
    vi.clearAllMocks();
  });

  // ── initiateRelease ───────────────────────────────────────────────────────

  describe('initiateRelease', () => {
    it('returns 400 when ownerId is missing', async () => {
      req.body = {};
      await initiateRelease(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
    });

    it('returns 403 when trustee has no active assignment for this owner (NFR-2)', async () => {
      req.body = { ownerId: 'owner-id-001' };
      TrusteeAssignment.findOne.mockResolvedValue(null);

      await initiateRelease(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.data.message).toMatch(/not an authorized trustee/i);
    });

    it('returns 409 when an active request already exists (prevents duplicate active requests)', async () => {
      req.body = { ownerId: 'owner-id-001' };
      TrusteeAssignment.findOne.mockResolvedValue({ _id: 'ta-001', status: 'active' });
      ReleaseRequest.findOne.mockResolvedValue({ _id: 'rr-001', status: 'pending' });

      await initiateRelease(req, res, next);

      expect(res.statusCode).toBe(409);
      expect(res.data.message).toMatch(/already exists/i);
    });

    it('creates a release request in awaiting_verification and emails OTP to trustee', async () => {
      req.body = { ownerId: 'owner-id-001' };
      TrusteeAssignment.findOne.mockResolvedValue({ _id: 'ta-001', status: 'active' });
      ReleaseRequest.findOne.mockResolvedValue(null); // no active request
      ReleaseRequest.create.mockResolvedValue({
        _id: 'rr-new',
        status: 'awaiting_verification',
        otpExpiresAt: new Date(Date.now() + 900000),
      });
      User.findById.mockReturnValue({
        select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ name: 'Bob Owner', email: 'bob@example.com' }) })
      });

      await initiateRelease(req, res, next);

      expect(ReleaseRequest.create).toHaveBeenCalled();
      expect(sendTrusteeOtpEmail).toHaveBeenCalled();
      expect(res.statusCode).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.data.requestId).toBeDefined();
    });
  });

  // ── verifyOtpAndStartGracePeriod ──────────────────────────────────────────

  describe('verifyOtpAndStartGracePeriod', () => {
    it('returns 400 when requestId or otp is missing', async () => {
      req.body = {};
      await verifyOtpAndStartGracePeriod(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 when the release request is not found or wrong state', async () => {
      req.body = { requestId: 'rr-bad', otp: '123456' };
      ReleaseRequest.findOne.mockResolvedValue(null);

      await verifyOtpAndStartGracePeriod(req, res, next);

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when the OTP has expired', async () => {
      req.body = { requestId: 'rr-001', otp: '123456' };
      ReleaseRequest.findOne.mockResolvedValue(
        makeSaveableDoc({
          _id: 'rr-001',
          status: 'awaiting_verification',
          otpExpiresAt: new Date(Date.now() - 1000), // expired
          verificationOtpHash: '$2b$10$hashedOtpValue',
        })
      );

      await verifyOtpAndStartGracePeriod(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.data.message).toMatch(/expired/i);
    });

    it('returns 400 when the OTP is incorrect (NFR-2: identity must be verified)', async () => {
      req.body = { requestId: 'rr-001', otp: '999999' };
      ReleaseRequest.findOne.mockResolvedValue(
        makeSaveableDoc({
          _id: 'rr-001',
          status: 'awaiting_verification',
          otpExpiresAt: new Date(Date.now() + 900000),
          verificationOtpHash: '$2b$10$hashedOtpValue',
        })
      );
      verifyOtp.mockResolvedValueOnce(false);

      await verifyOtpAndStartGracePeriod(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.data.message).toMatch(/invalid verification code/i);
    });

    it('transitions to pending, clears OTP hash, and notifies owner on valid OTP', async () => {
      req.body = { requestId: 'rr-001', otp: '123456' };
      const doc = makeSaveableDoc({
        _id: 'rr-001',
        ownerId: 'owner-id-001',
        trusteeId: 'trustee-id-001',
        status: 'awaiting_verification',
        otpExpiresAt: new Date(Date.now() + 900000),
        verificationOtpHash: '$2b$10$hashedOtpValue',
      });
      ReleaseRequest.findOne.mockResolvedValue(doc);
      verifyOtp.mockResolvedValueOnce(true);

      User.findById.mockImplementation((id) => ({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(
            id.toString() === 'owner-id-001'
              ? { name: 'Bob Owner', email: 'bob@example.com' }
              : { name: 'Alice Trustee', email: 'trustee@example.com' }
          )
        })
      }));

      await verifyOtpAndStartGracePeriod(req, res, next);

      expect(doc.status).toBe('pending');
      expect(doc.verificationOtpHash).toBeNull();
      expect(doc.gracePeriodExpiresAt).toBeDefined();
      expect(doc.save).toHaveBeenCalled();
      expect(sendOwnerReleaseNotification).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.data.data.status).toBe('pending');
    });
  });

  // ── cancelReleaseRequest ──────────────────────────────────────────────────

  describe('cancelReleaseRequest (owner veto — NFR-2)', () => {
    const ownerReq = () => makeReq({
      user: { _id: 'owner-id-001', email: 'owner@example.com', name: 'Bob Owner' },
      body: { requestId: 'rr-001' },
    });

    it('returns 400 when requestId is missing', async () => {
      const r = makeReq({ user: { _id: 'owner-id-001', email: 'owner@example.com', name: 'Bob' }, body: {} });
      await cancelReleaseRequest(r, res, next);
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when grace period has already expired (cannot cancel after expiry)', async () => {
      ReleaseRequest.findOneAndUpdate.mockResolvedValue(null); // condition not met
      const r = ownerReq();
      await cancelReleaseRequest(r, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.data.message).toMatch(/grace period has already expired|unable to cancel/i);
    });

    it('atomically cancels a pending request within the grace period', async () => {
      const r = ownerReq();
      ReleaseRequest.findOneAndUpdate.mockResolvedValue({
        _id: 'rr-001',
        ownerId: 'owner-id-001',
        trusteeId: 'trustee-id-001',
        status: 'cancelled',
        cancelledAt: new Date(),
      });

      await cancelReleaseRequest(r, res, next);

      expect(ReleaseRequest.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
        expect.objectContaining({ $set: expect.objectContaining({ status: 'cancelled' }) }),
        expect.any(Object)
      );
      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
    });

    it('prevents a non-owner from cancelling (query condition guards by ownerId)', async () => {
      // A trustee tries to cancel — findOneAndUpdate returns null because ownerId mismatch
      ReleaseRequest.findOneAndUpdate.mockResolvedValue(null);
      const r = makeReq({ user: { _id: 'trustee-id-001', email: 'trustee@example.com', name: 'Alice' }, body: { requestId: 'rr-001' } });
      await cancelReleaseRequest(r, res, next);
      expect(res.statusCode).toBe(400); // graceful 400, not info-leaking 403
    });
  });

  // ── getActiveReleaseStatus ────────────────────────────────────────────────

  describe('getActiveReleaseStatus', () => {
    it('returns null data when no active request exists', async () => {
      ReleaseRequest.findOne.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(null),
      });

      await getActiveReleaseStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.data.data).toBeNull();
    });

    it('returns the active request when it exists', async () => {
      const fake = { _id: 'rr-001', status: 'pending', gracePeriodExpiresAt: new Date() };
      ReleaseRequest.findOne.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(fake),
      });

      await getActiveReleaseStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.data.data.status).toBe('pending');
    });
  });

  // ── getReleasedVault ──────────────────────────────────────────────────────

  describe('getReleasedVault', () => {
    it('returns 404 when no released request exists for this trustee', async () => {
      req.query = { requestId: 'rr-001' };
      ReleaseRequest.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      await getReleasedVault(req, res, next);

      expect(res.statusCode).toBe(404);
    });

    it('returns wrapped keys and ciphertext for a completed release', async () => {
      req.query = { requestId: 'rr-001' };
      ReleaseRequest.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: 'rr-001',
          trusteeId: 'trustee-id-001',
          trusteeAssignmentId: 'ta-001',
          status: 'released',
          releasedAt: new Date(),
        })
      });
      TrusteeAssignment.findById.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue({
          assignedItems: [{ itemId: { _id: 'item-1', category: 'credential', encryptedContent: 'abc', contentIv: 'iv' }, encryptedKeyForTrustee: 'wrappedKey1' }]
        })
      });

      await getReleasedVault(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.data.data.items).toHaveLength(1);
      expect(res.data.data.items[0].encryptedKeyForTrustee).toBe('wrappedKey1');
    });
  });

  // ── getReleaseHistory ─────────────────────────────────────────────────────

  describe('getReleaseHistory', () => {
    it('returns terminated release requests for the owner', async () => {
      req = makeReq({ user: { _id: 'owner-id-001', email: 'owner@example.com', name: 'Bob' } });
      const chain = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([{ _id: 'rr-old', status: 'cancelled' }]),
      };
      ReleaseRequest.find.mockReturnValue(chain);

      await getReleaseHistory(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.data.data).toHaveLength(1);
    });
  });
});

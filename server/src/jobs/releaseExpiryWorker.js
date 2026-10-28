/**
 * Release Expiry Worker
 *
 * Runs inside the server process on a configurable polling interval.
 * Finds ReleaseRequests in `pending` state whose gracePeriodExpiresAt has passed,
 * then atomically transitions them to `released`.
 *
 * Design choices:
 *   - Uses findOneAndUpdate with a status condition as a lightweight optimistic lock.
 *     If two server instances run (e.g. after restart), both will attempt the update
 *     but only one will find status==='pending' on a given document — the second
 *     findOneAndUpdate will see status==='released' and skip.
 *   - Emails are sent AFTER the atomic write so a partial failure (email error) does
 *     not leave the document in an inconsistent state.
 *   - The polling interval is intentionally short (30s default) to minimize the
 *     window between actual expiry and the recorded releasedAt timestamp.
 *
 * Limitation: Not a true distributed lock. For production at scale, use a dedicated
 * job queue (e.g. BullMQ + Redis). This implementation is appropriate for the
 * project's single-server scope.
 */

import ReleaseRequest from '../models/ReleaseRequest.js';
import User from '../models/User.js';
import { RELEASE_STATUS, AUDIT_ACTIONS } from '../config/constants.js';
import { recordAuditEvent } from '../services/auditService.js';
import { sendReleaseExecutedNotifications } from '../services/notificationService.js';

const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds
let workerInterval = null;

/**
 * Processes all expired pending release requests in one polling tick.
 */
async function processExpiredRequests() {
  const now = new Date();

  // Find all pending requests whose grace period has expired
  const expired = await ReleaseRequest.find({
    status: RELEASE_STATUS.PENDING,
    gracePeriodExpiresAt: { $lte: now },
  }).lean();

  if (expired.length === 0) return;

  console.log(`[ReleaseWorker] Found ${expired.length} expired pending request(s) to process.`);

  for (const request of expired) {
    try {
      // Atomic transition: only succeeds if status is still 'pending'
      // Prevents double-processing if two workers run concurrently
      const updated = await ReleaseRequest.findOneAndUpdate(
        { _id: request._id, status: RELEASE_STATUS.PENDING },
        { $set: { status: RELEASE_STATUS.RELEASED, releasedAt: now } },
        { new: true }
      );

      if (!updated) {
        // Another worker already processed this request (status changed)
        console.log(`[ReleaseWorker] Request ${request._id} already processed — skipping.`);
        continue;
      }

      console.log(`[ReleaseWorker] Released request ${updated._id} for owner ${updated.ownerId}.`);

      // Fetch owner and trustee for notifications — graceful failure
      const [owner, trustee] = await Promise.all([
        User.findById(updated.ownerId).select('name email').lean(),
        User.findById(updated.trusteeId).select('name email').lean(),
      ]);

      // Send notifications (errors are caught inside sendReleaseExecutedNotifications)
      await sendReleaseExecutedNotifications({
        ownerEmail: owner?.email || 'unknown',
        ownerName: owner?.name || 'Vault Owner',
        trusteeEmail: trustee?.email || 'unknown',
        trusteeName: trustee?.name || 'Trustee',
        releasedAt: now,
      });

      // Record in audit log
      await recordAuditEvent({
        actorId: null,
        actorEmail: 'system',
        action: AUDIT_ACTIONS.RELEASE_AUTO_EXECUTED,
        targetId: updated._id,
        targetType: 'ReleaseRequest',
        status: 'success',
        metadata: {
          ownerId: updated.ownerId,
          trusteeId: updated.trusteeId,
          gracePeriodExpiresAt: updated.gracePeriodExpiresAt,
          releasedAt: now,
        },
      });
    } catch (err) {
      // Log but continue — one failed release must not block others
      console.error(`[ReleaseWorker] Error processing request ${request._id}:`, err.message);
      await recordAuditEvent({
        actorEmail: 'system',
        action: AUDIT_ACTIONS.RELEASE_AUTO_EXECUTED,
        targetId: request._id,
        targetType: 'ReleaseRequest',
        status: 'failure',
        metadata: { error: err.message },
      }).catch(() => {}); // audit failures must not throw
    }
  }
}

/**
 * Starts the release expiry polling worker.
 * Should be called once after the database connection is established.
 */
export function startReleaseExpiryWorker() {
  if (workerInterval) {
    console.warn('[ReleaseWorker] Worker already running — ignoring duplicate start call.');
    return;
  }

  console.log(`[ReleaseWorker] Starting. Polling every ${POLL_INTERVAL_MS / 1000}s.`);

  // Run immediately on start to process any requests that expired during downtime
  processExpiredRequests().catch((err) => {
    console.error('[ReleaseWorker] Initial poll error:', err.message);
  });

  workerInterval = setInterval(() => {
    processExpiredRequests().catch((err) => {
      console.error('[ReleaseWorker] Poll error:', err.message);
    });
  }, POLL_INTERVAL_MS);
}

/**
 * Stops the polling worker (useful for graceful shutdown and testing).
 */
export function stopReleaseExpiryWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[ReleaseWorker] Stopped.');
  }
}

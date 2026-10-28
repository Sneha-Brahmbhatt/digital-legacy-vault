/**
 * Audit Service
 * Thin wrapper around AuditLog.create().
 * Call site errors must NOT crash the main request — audit failures are logged
 * to console but the primary operation proceeds.
 */

import AuditLog from '../models/AuditLog.js';

/**
 * Records an audit event.
 *
 * @param {{
 *   actorId?: string,
 *   actorEmail?: string,
 *   action: string,
 *   targetId?: string,
 *   targetType?: string,
 *   status?: 'success' | 'failure' | 'info',
 *   ipAddress?: string,
 *   metadata?: object
 * }} params
 */
export async function recordAuditEvent(params) {
  try {
    await AuditLog.create({
      actorId: params.actorId || null,
      actorEmail: params.actorEmail || 'system',
      action: params.action,
      targetId: params.targetId || null,
      targetType: params.targetType || null,
      status: params.status || 'info',
      ipAddress: params.ipAddress || null,
      metadata: params.metadata || {},
      timestamp: new Date()
    });
  } catch (err) {
    // Audit failure must not surface to the user
    console.error('[AuditService] Failed to record audit event:', err.message, {
      action: params.action,
      actorEmail: params.actorEmail
    });
  }
}

/**
 * Retrieves paginated audit logs for a specific owner.
 * @param {string} ownerId
 * @param {number} page
 * @param {number} limit
 */
export async function getAuditLogsForOwner(ownerId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    AuditLog.find({ actorId: ownerId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments({ actorId: ownerId })
  ]);
  return { logs, total, page, pages: Math.ceil(total / limit) };
}

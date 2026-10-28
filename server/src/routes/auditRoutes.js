import express from 'express';
import { protect } from '../middleware/auth.js';
import AuditLog from '../models/AuditLog.js';
import { getAuditLogsForOwner } from '../services/auditService.js';

const router = express.Router();

router.use(protect);

/**
 * GET /api/audit
 * Returns paginated audit events for the authenticated user.
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const result = await getAuditLogsForOwner(req.user._id, page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;

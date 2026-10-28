import mongoose from 'mongoose';
import { AUDIT_ACTIONS } from '../config/constants.js';

const auditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  actorEmail: {
    type: String,
    default: 'system'
  },
  action: {
    type: String,
    enum: Object.values(AUDIT_ACTIONS),
    required: [true, 'Audit action is required']
  },
  // The primary resource affected (e.g. releaseRequestId, vaultItemId)
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  targetType: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'info'],
    default: 'info'
  },
  ipAddress: {
    type: String,
    default: null
  },
  // Structured metadata — never store plaintext secrets here
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  // No timestamps() — we use our own `timestamp` field for explicit control
  versionKey: false
});

// Index for fast owner-scoped audit queries
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ targetId: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;

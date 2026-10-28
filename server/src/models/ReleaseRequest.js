import mongoose from 'mongoose';
import { RELEASE_STATUS } from '../config/constants.js';

const releaseRequestSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required'],
    index: true
  },
  trusteeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Trustee ID is required'],
    index: true
  },
  trusteeAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrusteeAssignment',
    required: [true, 'Trustee assignment ID is required']
  },

  status: {
    type: String,
    enum: Object.values(RELEASE_STATUS),
    default: RELEASE_STATUS.AWAITING_VERIFICATION,
    index: true
  },

  // OTP stored as bcrypt hash — plaintext never persisted
  verificationOtpHash: {
    type: String,
    default: null
  },
  otpExpiresAt: {
    type: Date,
    default: null
  },

  // Set when OTP is verified and grace period begins
  gracePeriodExpiresAt: {
    type: Date,
    default: null,
    index: true  // queried by the expiry worker
  },

  // Termination metadata
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  releasedAt: {
    type: Date,
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true   // createdAt = initiation time, updatedAt = last transition
});

// Only one non-terminal request per owner at a time
// The application enforces this; the index helps catch races
releaseRequestSchema.index(
  { ownerId: 1, status: 1 },
  {
    partialFilterExpression: {
      status: { $in: [RELEASE_STATUS.AWAITING_VERIFICATION, RELEASE_STATUS.PENDING] }
    }
  }
);

const ReleaseRequest = mongoose.model('ReleaseRequest', releaseRequestSchema);
export default ReleaseRequest;

import mongoose from 'mongoose';
import { TRUSTEE_STATUS } from '../config/constants.js';

const assignedItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultItem',
    required: true
  },
  // AES Data Encryption Key wrapped using Trustee's RSA-OAEP Public Key
  encryptedKeyForTrustee: {
    type: String,
    required: true
  }
}, { _id: false });

const trusteeAssignmentSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required'],
    index: true
  },
  trusteeEmail: {
    type: String,
    required: [true, 'Trustee email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Valid trustee email address is required']
  },
  trusteeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedItems: [assignedItemSchema],
  status: {
    type: String,
    enum: Object.values(TRUSTEE_STATUS),
    default: TRUSTEE_STATUS.ACTIVE
  }
}, {
  timestamps: true
});

// Compound unique index: an owner can only have one assignment record per trustee email
trusteeAssignmentSchema.index({ ownerId: 1, trusteeEmail: 1 }, { unique: true });

const TrusteeAssignment = mongoose.model('TrusteeAssignment', trusteeAssignmentSchema);
export default TrusteeAssignment;

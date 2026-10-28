import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required']
  },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.OWNER
  },
  // Asymmetric cryptographic keypair components for zero-knowledge key wrapping
  publicKey: {
    type: String,
    default: null // Base64 exported SPKI public key
  },
  encryptedPrivateKey: {
    type: String,
    default: null // Client-encrypted private key (safe for cross-device retrieval)
  },
  privateKeyIv: {
    type: String,
    default: null
  },
  privateKeySalt: {
    type: String,
    default: null
  },
  // Owner configuration
  gracePeriodHours: {
    type: Number,
    default: 48, // 2 days default as approved
    min: [1, 'Grace period must be at least 1 hour'],
    max: [720, 'Grace period cannot exceed 30 days (720 hours)']
  },
  // Active session refresh tokens for secure invalidation
  refreshTokens: [
    {
      token: { type: String, required: true },
      createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 } // auto-cleanup after 7d
    }
  ]
}, {
  timestamps: true
});

// Compare entered password with stored bcrypt hash
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash passwords
userSchema.statics.hashPassword = async function(plaintextPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plaintextPassword, salt);
};

// Exclude sensitive internal fields in JSON responses
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokens;
  delete obj.__v;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;

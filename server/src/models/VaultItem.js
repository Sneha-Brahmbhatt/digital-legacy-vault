import mongoose from 'mongoose';
import { VAULT_CATEGORIES } from '../config/constants.js';

const vaultItemSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required'],
    index: true
  },
  category: {
    type: String,
    enum: Object.values(VAULT_CATEGORIES),
    required: [true, 'Category is required (credential, document, or message)']
  },
  // Encrypted item title and payload (Zero-Knowledge Invariant)
  encryptedTitle: {
    type: String,
    required: [true, 'Encrypted title is required']
  },
  titleIv: {
    type: String,
    required: [true, 'Title IV is required']
  },
  encryptedData: {
    type: String,
    required: [true, 'Encrypted payload is required']
  },
  dataIv: {
    type: String,
    required: [true, 'Data IV is required']
  },
  // AES Data Encryption Key (DEK) wrapped using Owner's RSA-OAEP Public Key
  encryptedKeyForOwner: {
    type: String,
    required: [true, 'Wrapped key for owner is required']
  },
  // Metadata for encrypted documents (Cloudinary or local storage references)
  fileMetadata: {
    storageId: { type: String, default: null },
    originalNameCiphertext: { type: String, default: null },
    originalNameIv: { type: String, default: null },
    mimeType: { type: String, default: null },
    size: { type: Number, default: 0 },
    isEncrypted: { type: Boolean, default: true }
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Index to quickly query owner items sorted by creation date
vaultItemSchema.index({ ownerId: 1, createdAt: -1 });

const VaultItem = mongoose.model('VaultItem', vaultItemSchema);
export default VaultItem;

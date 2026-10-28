import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { ENV } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/encrypted');

// Ensure local fallback uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const uploadEncryptedBlob = async (ciphertextBase64, mimeType = 'application/octet-stream') => {
  // Max file size enforcement: 5MB of ciphertext
  const buffer = Buffer.from(ciphertextBase64, 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Encrypted file exceeds maximum allowed size of 5MB.');
  }

  // Check if real Cloudinary credentials exist
  if (ENV.CLOUDINARY_CLOUD_NAME && ENV.CLOUDINARY_API_KEY && ENV.CLOUDINARY_API_SECRET) {
    try {
      const cloudinary = (await import('cloudinary')).v2;
      cloudinary.config({
        cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
        api_key: ENV.CLOUDINARY_API_KEY,
        api_secret: ENV.CLOUDINARY_API_SECRET
      });

      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'digital_legacy_vault/encrypted_documents',
            public_id: `enc_doc_${crypto.randomBytes(16).toString('hex')}`
          },
          (error, result) => {
            if (error) {
              console.warn('[Storage] Cloudinary upload failed, falling back to local storage:', error.message);
              resolve(saveLocally(buffer, mimeType));
            } else {
              resolve({
                storageId: result.public_id,
                storageType: 'cloudinary',
                size: buffer.length,
                url: result.secure_url
              });
            }
          }
        );
        uploadStream.end(buffer);
      });
    } catch (err) {
      console.warn('[Storage] Cloudinary setup error, falling back to local storage:', err.message);
      return saveLocally(buffer, mimeType);
    }
  }

  // Fallback to local encrypted storage
  return saveLocally(buffer, mimeType);
};

const saveLocally = (buffer, mimeType) => {
  const storageId = `enc_doc_${crypto.randomBytes(16).toString('hex')}.enc`;
  const filePath = path.join(UPLOADS_DIR, storageId);
  fs.writeFileSync(filePath, buffer);

  return {
    storageId,
    storageType: 'local_encrypted',
    size: buffer.length,
    url: null
  };
};

export const getEncryptedBlob = async (storageId, storageType) => {
  if (storageType === 'cloudinary' && ENV.CLOUDINARY_CLOUD_NAME) {
    try {
      const cloudinary = (await import('cloudinary')).v2;
      const url = cloudinary.url(storageId, { resource_type: 'raw' });
      const res = await fetch(url);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf).toString('base64');
      }
    } catch (e) {
      console.warn('[Storage] Cloudinary fetch failed, falling back to local check');
    }
  }

  const filePath = path.join(UPLOADS_DIR, storageId);
  if (!fs.existsSync(filePath)) {
    throw new Error('Encrypted file not found on server.');
  }

  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
};

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import VaultItem from '../src/models/VaultItem.js';
import { generateAccessToken } from '../src/utils/tokenUtils.js';

describe('Vault Management & Zero-Knowledge Security Suite (FR-2, FR-3, FR-4, NFR-1)', () => {
  let mockUsers = new Map();
  let mockVault = new Map();
  let owner1, owner2, token1, token2;

  beforeEach(async () => {
    mockUsers.clear();
    mockVault.clear();
    vi.restoreAllMocks();

    const id1 = new mongoose.Types.ObjectId();
    const id2 = new mongoose.Types.ObjectId();

    owner1 = {
      _id: id1,
      name: 'Owner One',
      email: 'owner1@example.com',
      role: 'owner',
      publicKey: 'mockOwner1PublicKey'
    };

    owner2 = {
      _id: id2,
      name: 'Owner Two',
      email: 'owner2@example.com',
      role: 'owner',
      publicKey: 'mockOwner2PublicKey'
    };

    mockUsers.set(id1.toString(), owner1);
    mockUsers.set(id2.toString(), owner2);

    token1 = generateAccessToken(owner1);
    token2 = generateAccessToken(owner2);

    // Mock User.findById
    vi.spyOn(User, 'findById').mockImplementation(async (id) => {
      return mockUsers.get(id?.toString()) || null;
    });

    // Mock VaultItem.find
    vi.spyOn(VaultItem, 'find').mockImplementation((filter) => {
      let results = Array.from(mockVault.values());
      if (filter.ownerId) {
        results = results.filter(i => i.ownerId.toString() === filter.ownerId.toString());
      }
      if (filter.category) {
        results = results.filter(i => i.category === filter.category);
      }
      return {
        sort: () => Promise.resolve(results)
      };
    });

    // Mock VaultItem.findById
    vi.spyOn(VaultItem, 'findById').mockImplementation(async (id) => {
      return mockVault.get(id?.toString()) || null;
    });

    // Mock VaultItem.deleteOne
    vi.spyOn(VaultItem, 'deleteOne').mockImplementation(async (filter) => {
      const id = filter._id.toString();
      mockVault.delete(id);
      return { deletedCount: 1 };
    });

    // Mock VaultItem constructor save
    vi.spyOn(VaultItem.prototype, 'save').mockImplementation(async function() {
      if (!this._id) {
        this._id = new mongoose.Types.ObjectId();
      }
      mockVault.set(this._id.toString(), this);
      return this;
    });
  });

  const validCiphertextPayload = {
    category: 'credential',
    encryptedTitle: 'Wp9yP2+MockCiphertextTitle==',
    titleIv: '12ByteTitleIv==',
    encryptedData: 'Xy78K1+MockEncryptedPayloadData==',
    dataIv: '12ByteDataIv==',
    encryptedKeyForOwner: 'WrappedAesDekWithRsaOaepPublicKey==',
    tags: ['banking', 'critical']
  };

  it('FR-3 / NFR-1: creates vault entry storing ONLY ciphertext and IVs (server receives zero plaintext)', async () => {
    const res = await request(app)
      .post('/api/vault')
      .set('Authorization', `Bearer ${token1}`)
      .send(validCiphertextPayload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.encryptedTitle).toBe(validCiphertextPayload.encryptedTitle);
    expect(res.body.data.encryptedData).toBe(validCiphertextPayload.encryptedData);
    expect(res.body.data.encryptedKeyForOwner).toBe(validCiphertextPayload.encryptedKeyForOwner);

    // Verify stored entity contains NO plaintext properties
    const stored = mockVault.get(res.body.data._id.toString());
    expect(stored.title).toBeUndefined();
    expect(stored.password).toBeUndefined();
    expect(stored.username).toBeUndefined();
    expect(stored.encryptedData).toBe(validCiphertextPayload.encryptedData);
  });

  it('FR-2: lists vault entries belonging to the authenticated owner', async () => {
    await request(app)
      .post('/api/vault')
      .set('Authorization', `Bearer ${token1}`)
      .send(validCiphertextPayload)
      .expect(201);

    const res = await request(app)
      .get('/api/vault')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].category).toBe('credential');
  });

  it('FR-2: filters items by category (credential, document, message)', async () => {
    await request(app)
      .post('/api/vault')
      .set('Authorization', `Bearer ${token1}`)
      .send(validCiphertextPayload)
      .expect(201);

    await request(app)
      .post('/api/vault')
      .set('Authorization', `Bearer ${token1}`)
      .send({ ...validCiphertextPayload, category: 'message' })
      .expect(201);

    const credRes = await request(app)
      .get('/api/vault?category=credential')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(credRes.body.count).toBe(1);
    expect(credRes.body.data[0].category).toBe('credential');

    const msgRes = await request(app)
      .get('/api/vault?category=message')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(msgRes.body.count).toBe(1);
    expect(msgRes.body.data[0].category).toBe('message');
  });

  it('NFR-1 / Security: strictly prevents Owner 2 from viewing Owner 1 entry (403 Forbidden)', async () => {
    const createRes = await request(app)
      .post('/api/vault')
      .set('Authorization', `Bearer ${token1}`)
      .send(validCiphertextPayload)
      .expect(201);

    const itemId = createRes.body.data._id;

    const res = await request(app)
      .get(`/api/vault/${itemId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Access denied');
  });

  it('FR-2 / Security: strictly prevents Owner 2 from deleting Owner 1 entry (403 Forbidden)', async () => {
    const createRes = await request(app)
      .post('/api/vault')
      .set('Authorization', `Bearer ${token1}`)
      .send(validCiphertextPayload)
      .expect(201);

    const itemId = createRes.body.data._id;

    await request(app)
      .delete(`/api/vault/${itemId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    expect(mockVault.has(itemId.toString())).toBe(true);
  });

  it('FR-2: allows authorized owner to delete their own entry', async () => {
    const createRes = await request(app)
      .post('/api/vault')
      .set('Authorization', `Bearer ${token1}`)
      .send(validCiphertextPayload)
      .expect(201);

    const itemId = createRes.body.data._id;

    await request(app)
      .delete(`/api/vault/${itemId}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(mockVault.has(itemId.toString())).toBe(false);
  });

  it('FR-4: stores client-side encrypted document blob and retrieves it securely', async () => {
    const fakeCiphertextBase64 = Buffer.from('ClientSideEncryptedBinaryDataBlob').toString('base64');

    // 1. Upload encrypted file
    const uploadRes = await request(app)
      .post('/api/vault/upload-document')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        ciphertextBase64: fakeCiphertextBase64,
        mimeType: 'application/pdf'
      })
      .expect(200);

    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.data.storageId).toBeDefined();

    // 2. Link file in a vault entry
    const entryRes = await request(app)
      .post('/api/vault')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        ...validCiphertextPayload,
        category: 'document',
        fileMetadata: {
          storageId: uploadRes.body.data.storageId,
          storageType: uploadRes.body.data.storageType,
          fileName: 'Will.pdf',
          size: 1024,
          isEncrypted: true
        }
      })
      .expect(201);

    const itemId = entryRes.body.data._id;

    // 3. Download encrypted document as Owner 1
    const downloadRes = await request(app)
      .get(`/api/vault/${itemId}/document`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(downloadRes.body.success).toBe(true);
    expect(downloadRes.body.data.ciphertextBase64).toBe(fakeCiphertextBase64);

    // 4. Verify Owner 2 cannot download Owner 1 document (403 Forbidden)
    await request(app)
      .get(`/api/vault/${itemId}/document`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);
  });

  it('Validation: rejects document upload exceeding 5MB size limit', async () => {
    // Generate a buffer larger than 5MB
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024);
    const largeCiphertextBase64 = largeBuffer.toString('base64');

    const res = await request(app)
      .post('/api/vault/upload-document')
      .set('Authorization', `Bearer ${token1}`)
      .send({ ciphertextBase64: largeCiphertextBase64 })
      .expect(500); // Storage service throws error caught by global error handler

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('exceeds maximum allowed size');
  });

  it('Validation: rejects item creation if required cryptographic ciphertext or IVs are missing', async () => {
    const res = await request(app)
      .post('/api/vault')
      .set('Authorization', `Bearer ${token1}`)
      .send({ category: 'credential' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});

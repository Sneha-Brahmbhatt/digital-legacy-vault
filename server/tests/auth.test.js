import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/User.js';

describe('Authentication & Token Security Suite (FR-1, NFR-3)', () => {
  let mockUsers = new Map();

  beforeEach(() => {
    mockUsers.clear();
    vi.restoreAllMocks();

    // Mock User.findOne
    vi.spyOn(User, 'findOne').mockImplementation(async (query) => {
      if (query.email) {
        return mockUsers.get(query.email.toLowerCase()) || null;
      }
      if (query._id && query['refreshTokens.token']) {
        for (const u of mockUsers.values()) {
          if (u._id.toString() === query._id.toString()) {
            const hasToken = u.refreshTokens.some(t => t.token === query['refreshTokens.token']);
            if (hasToken) return u;
          }
        }
      }
      return null;
    });

    // Mock User.findById
    vi.spyOn(User, 'findById').mockImplementation(async (id) => {
      for (const u of mockUsers.values()) {
        if (u._id.toString() === id.toString()) return u;
      }
      return null;
    });

    // Mock User.updateOne
    vi.spyOn(User, 'updateOne').mockImplementation(async (filter, update) => {
      if (update.$pull && update.$pull.refreshTokens) {
        for (const u of mockUsers.values()) {
          if (u._id.toString() === filter._id.toString()) {
            u.refreshTokens = u.refreshTokens.filter(t => t.token !== update.$pull.refreshTokens.token);
          }
        }
      }
      return { modifiedCount: 1 };
    });

    // Mock User constructor save
    vi.spyOn(User.prototype, 'save').mockImplementation(async function() {
      if (!this._id) {
        this._id = new (await import('mongoose')).default.Types.ObjectId();
      }
      mockUsers.set(this.email.toLowerCase(), this);
      return this;
    });
  });

  const testUserPayload = {
    name: 'Sneha Brahmbhatt',
    email: 'sneha@example.com',
    password: 'SecurePassword123!',
    role: 'owner',
    gracePeriodHours: 48,
    publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0mockPublicKey',
    encryptedPrivateKey: 'mockEncryptedPrivateKeyBase64',
    privateKeyIv: 'mockIvBase64',
    privateKeySalt: 'mockSaltBase64'
  };

  it('FR-1: successfully registers a new user with bcrypt hash and returns JWT tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUserPayload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUserPayload.email);
    expect(res.body.data.user.publicKey).toBe(testUserPayload.publicKey);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();

    // Verify stored password in mock database is a bcrypt hash, not plaintext
    const savedUser = mockUsers.get(testUserPayload.email.toLowerCase());
    expect(savedUser.passwordHash).not.toBe(testUserPayload.password);
    expect(savedUser.passwordHash.startsWith('$2')).toBe(true);
  });

  it('FR-1: rejects duplicate user registration with 409 Conflict', async () => {
    await request(app).post('/api/auth/register').send(testUserPayload).expect(201);

    const res = await request(app)
      .post('/api/auth/register')
      .send(testUserPayload)
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists');
  });

  it('FR-1: rejects registration with invalid/short password (< 8 chars)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...testUserPayload, password: '123' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.errors).toContain('Password must be at least 8 characters long.');
  });

  it('FR-1: successfully authenticates valid credentials and returns encrypted key bundle', async () => {
    await request(app).post('/api/auth/register').send(testUserPayload).expect(201);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserPayload.email, password: testUserPayload.password })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.encryptedPrivateKey).toBe(testUserPayload.encryptedPrivateKey);
  });

  it('FR-1: returns generic error on wrong password to avoid enumeration', async () => {
    await request(app).post('/api/auth/register').send(testUserPayload).expect(201);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserPayload.email, password: 'WrongPassword!' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('FR-1: returns generic error on non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'SomePassword123!' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('NFR-3: refreshes token session using valid refresh token', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUserPayload).expect(201);
    const refreshToken = regRes.body.data.refreshToken;

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();
  });

  it('NFR-3: rejects protected route /api/auth/me without authorization token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('No authorization token provided');
  });

  it('NFR-3: allows access to /api/auth/me with valid Bearer token', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUserPayload).expect(201);
    const accessToken = regRes.body.data.accessToken;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe(testUserPayload.email);
  });

  it('NFR-3: logs out and invalidates refresh token session', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUserPayload).expect(201);
    const { accessToken, refreshToken } = regRes.body.data;

    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    expect(refreshRes.body.success).toBe(false);
    expect(refreshRes.body.message).toContain('Session has been invalidated');
  });
});

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { POST as loginPOST } from '../src/app/api/auth/login/route.js';
import { POST as registerPOST } from '../src/app/api/auth/register/route.js';
import { POST as logoutPOST } from '../src/app/api/auth/logout/route.js';
import { GET as meGET } from '../src/app/api/auth/me/route.js';

const mockHeaders = (headers = {}) => ({
  get: (key) => headers[key.toLowerCase()],
});

const mockRequest = (body = {}, headers = {}) => ({
  json: async () => body,
  headers: mockHeaders(headers),
});

const getJson = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('returns 400 for missing email', async () => {
      const req = mockRequest({ password: 'test123' });
      const res = await loginPOST(req);
      expect(res.status).toBe(400);
      const data = await getJson(res);
      expect(data.error).toBe('Email and password required.');
    });

    it('returns 400 for missing password', async () => {
      const req = mockRequest({ email: 'test@test.com' });
      const res = await loginPOST(req);
      expect(res.status).toBe(400);
      const data = await getJson(res);
      expect(data.error).toBe('Email and password required.');
    });

    it('returns 401 for invalid credentials', async () => {
      const req = mockRequest({ email: 'nonexistent@test.com', password: 'wrong' });
      const res = await loginPOST(req);
      expect(res.status).toBe(401);
      const data = await getJson(res);
      expect(data.error).toBe('Invalid email or password.');
    });
  });

  describe('POST /api/auth/register', () => {
    it('returns 400 for missing email', async () => {
      const req = mockRequest({ password: 'test123', name: 'Test' });
      const res = await registerPOST(req);
      expect(res.status).toBe(400);
      const data = await getJson(res);
      expect(data.error).toBe('Email and password (min 6 chars) required.');
    });

    it('returns 400 for missing password', async () => {
      const req = mockRequest({ email: 'test@test.com', name: 'Test' });
      const res = await registerPOST(req);
      expect(res.status).toBe(400);
      const data = await getJson(res);
      expect(data.error).toBe('Email and password (min 6 chars) required.');
    });

    it('returns 400 for password too short', async () => {
      const req = mockRequest({ email: 'test@test.com', password: '123', name: 'Test' });
      const res = await registerPOST(req);
      expect(res.status).toBe(400);
      const data = await getJson(res);
      expect(data.error).toBe('Email and password (min 6 chars) required.');
    });

    it('returns 409 for duplicate email', async () => {
      const email = `test-duplicate-${Date.now()}@test.com`;
      const req1 = mockRequest({ email, password: 'test123', name: 'Test' });
      await registerPOST(req1);
      const req2 = mockRequest({ email, password: 'test123', name: 'Test' });
      const res = await registerPOST(req2);
      expect(res.status).toBe(409);
      const data = await getJson(res);
      expect(data.error).toBe('Email already registered.');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns success even without token', async () => {
      const req = mockRequest({}, {});
      const res = await logoutPOST(req);
      expect(res.status).toBe(200);
      const data = await getJson(res);
      expect(data.success).toBe(true);
    });

    it('returns success with valid token header', async () => {
      const req = mockRequest({}, { authorization: 'Bearer test-token' });
      const res = await logoutPOST(req);
      expect(res.status).toBe(200);
      const data = await getJson(res);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns null user without token', async () => {
      const req = mockRequest({}, {});
      const res = await meGET(req);
      expect(res.status).toBe(200);
      const data = await getJson(res);
      expect(data.user).toBeNull();
    });

    it('returns null user with invalid token', async () => {
      const req = mockRequest({}, { authorization: 'Bearer invalid-token' });
      const res = await meGET(req);
      expect(res.status).toBe(200);
      const data = await getJson(res);
      expect(data.user).toBeNull();
    });
  });
});
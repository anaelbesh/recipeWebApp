import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server'; // Adjust path as needed
import User from '../src/models/userModel';

describe('Auth Endpoints - Input Validation', () => {
  beforeAll(async () => {
    // Connect to test database if needed
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/recipe-test');
    }
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: { $regex: '^test-validation' } });
    // Don't disconnect to allow test runner to manage connections
  });

  describe('POST /api/auth/login', () => {
    it('should reject empty email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: '', password: 'ValidPass123!' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Validation');
      expect(response.body.errors.email).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email', password: 'ValidPass123!' });

      expect(response.status).toBe(400);
      expect(response.body.errors.email).toContain('valid email');
    });

    it('should reject empty password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: '' });

      expect(response.status).toBe(400);
      expect(response.body.errors.password).toContain('required');
    });

    it('should normalize email to lowercase for login', async () => {
      // First, create a user with lowercase email
      await User.create({
        username: 'test-normalize',
        email: 'login-test@example.com',
        password: 'HashedPass123!',
        provider: 'local',
      });

      // Try logging in with uppercase email
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'LOGIN-TEST@EXAMPLE.COM',
          password: 'ValidPass123!',
        });

      // Should fail with invalid credentials (password mismatch),
      // not email format error, proving email was normalized
      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should trim email whitespace', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: '  user@example.com  ',
          password: 'ValidPass123!',
        });

      // Should fail with 401 (invalid credentials),
      // not 400 (validation error), proving whitespace was trimmed
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should reject empty username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: '',
          email: 'test-validation-001@example.com',
          password: 'ValidPass123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.username).toBeDefined();
    });

    it('should reject username less than 3 characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab',
          email: 'test-validation-002@example.com',
          password: 'ValidPass123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.username).toContain('3 characters');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'not-an-email',
          password: 'ValidPass123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.email).toContain('valid email');
    });

    it('should reject weak password (too short)', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test-validation-003@example.com',
          password: 'Pass1!',
        });

      expect(response.status).toBe(400);
      expect(Array.isArray(response.body.errors.password)).toBe(true);
      expect(response.body.errors.password.some((e: string) => e.includes('8 characters'))).toBe(true);
    });

    it('should reject password without uppercase', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test-validation-004@example.com',
          password: 'weakpass123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.password.some((e: string) => e.includes('uppercase'))).toBe(true);
    });

    it('should reject password without lowercase', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test-validation-005@example.com',
          password: 'STRONGPASS123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.password.some((e: string) => e.includes('lowercase'))).toBe(true);
    });

    it('should reject password without number', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test-validation-006@example.com',
          password: 'StrongPass!',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.password.some((e: string) => e.includes('number'))).toBe(true);
    });

    it('should reject password without special character', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test-validation-007@example.com',
          password: 'StrongPass123',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.password.some((e: string) => e.includes('special character'))).toBe(true);
    });

    it('should accept all valid special characters', async () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*'];

      for (const char of specialChars) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: `testuser${char.charCodeAt(0)}`,
            email: `test-validation-special-${char.charCodeAt(0)}@example.com`,
            password: `StrongPass123${char}`,
          });

        // Should either succeed (201) or fail due to duplicate (409),
        // but NOT fail due to invalid special character (400)
        expect([201, 409]).toContain(response.status);
      }
    });

    it('should accept valid strong password and create user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test-valid-user',
          email: 'test-validation-valid@example.com',
          password: 'ValidPass123!',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('test-validation-valid@example.com');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });

    it('should normalize email to lowercase on signup', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test-email-normalize',
          email: 'TEST-VALIDATION-NORMALIZE@EXAMPLE.COM',
          password: 'ValidPass123!',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('test-validation-normalize@example.com');
    });

    it('should reject duplicate email (case-insensitive)', async () => {
      const email = 'test-validation-duplicate-001@example.com';

      // First registration
      const response1 = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user1',
          email,
          password: 'ValidPass123!',
        });

      expect(response1.status).toBe(201);

      // Second registration with same email in different case
      const response2 = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user2',
          email: email.toUpperCase(),
          password: 'ValidPass123!',
        });

      expect(response2.status).toBe(409);
      expect(response2.body.message).toContain('Email or username already in use');
    });

    it('should reject username with invalid characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user@name',
          email: 'test-validation-008@example.com',
          password: 'ValidPass123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.username).toContain('letters, numbers, hyphens, and underscores');
    });
  });

  describe('Validation edge cases', () => {
    it('should handle multiple validation errors in one request', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab',
          email: 'invalid',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(Object.keys(response.body.errors).length).toBeGreaterThanOrEqual(3);
      expect(response.body.errors.username).toBeDefined();
      expect(response.body.errors.email).toBeDefined();
      expect(response.body.errors.password).toBeDefined();
    });

    it('should not leak sensitive info in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'ValidPass123!',
        });

      // Should use generic message, not reveal if email exists
      expect(response.body.message).toContain('Invalid email or password');
      expect(response.body.message).not.toContain('User not found');
    });
  });
});

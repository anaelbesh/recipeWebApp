import request from 'supertest';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { app } from '../../src/server';
import User from '../../src/models/userModel';
import RefreshToken from '../../src/models/refreshTokenModel';
import { connectMongo } from '../../src/db';

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures');
const TEST_IMAGE_PATH = path.join(FIXTURE_DIR, 'test-upload.png');

// Tiny valid PNG (1×1, base64 encoded)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';

let accessToken: string;
let userId: string;

const testUser = {
  email: 'upload_test@test.com',
  username: 'upload_testuser',
  password: 'TestPass123!',
};

describe('Upload Endpoints', () => {
  beforeAll(async () => {
    await connectMongo();

    // Create fixtures directory if it doesn't exist
    if (!fs.existsSync(FIXTURE_DIR)) {
      fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    }

    // Write test image
    fs.writeFileSync(TEST_IMAGE_PATH, Buffer.from(TINY_PNG_BASE64, 'base64'));

    // Clean up test user
    const existingUser = await User.findOne({ email: testUser.email });
    if (existingUser) {
      await RefreshToken.deleteMany({ userId: existingUser._id });
      await User.deleteOne({ _id: existingUser._id });
    }

    // Register test user
    const res = await request(app).post('/api/auth/register').send(testUser);
    accessToken = res.body.accessToken;
    userId = res.body.user.id;
  });

  afterAll(async () => {
    await User.deleteOne({ email: testUser.email });
    if (fs.existsSync(TEST_IMAGE_PATH)) {
      fs.unlinkSync(TEST_IMAGE_PATH);
    }
    await mongoose.disconnect();
  });

  describe('POST /api/uploads/recipe-image', () => {
    it('should upload a recipe image successfully', async () => {
      const res = await request(app)
        .post('/api/uploads/recipe-image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', TEST_IMAGE_PATH);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('imageUrl');
      expect(res.body.imageUrl).toMatch(/\/uploads\/recipe-images\//);
    });

    it('should return 401 without authentication', async () => {
      try {
        const res = await request(app)
          .post('/api/uploads/recipe-image');
        expect(res.status).toBe(401);
      } catch (err: any) {
        // Handle ECONNRESET by retrying once
        if (err.code === 'ECONNRESET') {
          const res = await request(app)
            .post('/api/uploads/recipe-image');
          expect(res.status).toBe(401);
        } else {
          throw err;
        }
      }
    });

    it('should return 400 if no file is provided', async () => {
      const res = await request(app)
        .post('/api/uploads/recipe-image')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
    });

    it('should reject invalid file types', async () => {
      // Create a temporary text file
      const txtPath = path.join(FIXTURE_DIR, 'test.txt');
      fs.writeFileSync(txtPath, 'This is not an image');

      const res = await request(app)
        .post('/api/uploads/recipe-image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('image', txtPath);

      expect(res.status).toBe(400);

      fs.unlinkSync(txtPath);
    });
  });
});

import express from 'express';
import request from 'supertest';

const singleMock = jest.fn();
const verifyTokenMock = jest.fn((req: any, _res: any, next: any) => {
  req.user = { id: 'u1' };
  next();
});
const uploadRecipeImageMock = jest.fn((req: any, res: any) => res.status(200).json({ ok: true, user: req.user?.id }));

jest.mock('../src/middleware/upload', () => ({
  createUpload: jest.fn(() => ({ single: singleMock })),
}));
jest.mock('../src/middleware/authMiddleware', () => ({ verifyToken: verifyTokenMock }));
jest.mock('../src/controllers/uploadController', () => ({ uploadRecipeImage: uploadRecipeImageMock }));

describe('uploadRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 for LIMIT_FILE_SIZE errors', async () => {
    singleMock.mockImplementation(() => (_req: any, _res: any, next: any) => next({ code: 'LIMIT_FILE_SIZE' }));

    const { default: uploadRoutes } = await import('../src/routes/uploadRoutes');
    const app = express();
    app.use(uploadRoutes);

    const res = await request(app).post('/recipe-image');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('exceeds');
  });

  test('returns 400 for invalid file type errors', async () => {
    singleMock.mockImplementation(() => (_req: any, _res: any, next: any) => next(new Error('Only jpg, png, and webp are allowed')));

    const { default: uploadRoutes } = await import('../src/routes/uploadRoutes');
    const app = express();
    app.use(uploadRoutes);

    const res = await request(app).post('/recipe-image');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only jpg, png, and webp');
  });

  test('returns 500 for unknown multer errors', async () => {
    singleMock.mockImplementation(() => (_req: any, _res: any, next: any) => next(new Error('boom')));

    const { default: uploadRoutes } = await import('../src/routes/uploadRoutes');
    const app = express();
    app.use(uploadRoutes);

    const res = await request(app).post('/recipe-image');
    expect(res.status).toBe(500);
  });

  test('passes through auth and controller on success', async () => {
    singleMock.mockImplementation(() => (_req: any, _res: any, next: any) => next());

    const { default: uploadRoutes } = await import('../src/routes/uploadRoutes');
    const app = express();
    app.use(uploadRoutes);

    const res = await request(app).post('/recipe-image');
    expect(res.status).toBe(200);
    expect(res.body.user).toBe('u1');
    expect(verifyTokenMock).toHaveBeenCalled();
    expect(uploadRecipeImageMock).toHaveBeenCalled();
  });
});

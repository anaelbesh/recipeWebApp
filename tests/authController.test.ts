import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { login, logout, refreshToken as refreshAccessToken, register } from '../src/controllers/authController';
import User from '../src/models/userModel';
import RefreshToken from '../src/models/refreshTokenModel';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('../src/models/userModel', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('../src/models/refreshTokenModel', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findOne: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

function createRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.sign as jest.Mock)
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token');
  });

  describe('register', () => {
    test('returns 400 when validated fields are missing', async () => {
      const req: any = { body: {} };
      const res = createRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Validation failed' });
    });

    test('returns 409 when user already exists', async () => {
      const req: any = {
        body: {},
        validated: { username: 'u1', email: 'u@test.com', password: 'Pass123!' },
      };
      const res = createRes();

      (User.findOne as jest.Mock).mockResolvedValue({ _id: 'existing' });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(RefreshToken.create).not.toHaveBeenCalled();
    });

    test('creates user and tokens successfully', async () => {
      const req: any = {
        body: { rememberMe: true },
        validated: { username: 'u1', email: 'u@test.com', password: 'Pass123!' },
      };
      const res = createRes();

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      (User.create as jest.Mock).mockResolvedValue({
        _id: 'u1id',
        username: 'u1',
        email: 'u@test.com',
        profilePicture: null,
      });

      await register(req, res);

      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed', provider: 'local' }),
      );
      expect(RefreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'refresh-token', rememberMe: true }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-token' }));
    });
  });

  describe('login', () => {
    test('returns 400 when validated fields are missing', async () => {
      const req: any = { body: {}, validated: { email: 'u@test.com' } };
      const res = createRes();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 401 when user is not found', async () => {
      const req: any = { body: {}, validated: { email: 'u@test.com', password: 'Pass123!' } };
      const res = createRes();

      (User.findOne as jest.Mock).mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid email or password' });
    });

    test('returns 400 when account is oauth provider', async () => {
      const req: any = { body: {}, validated: { email: 'u@test.com', password: 'Pass123!' } };
      const res = createRes();

      (User.findOne as jest.Mock).mockResolvedValue({ provider: 'google' });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 401 for invalid password', async () => {
      const req: any = { body: {}, validated: { email: 'u@test.com', password: 'Pass123!' } };
      const res = createRes();

      (User.findOne as jest.Mock).mockResolvedValue({ provider: 'local', password: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 200 and tokens for valid login', async () => {
      const req: any = {
        body: { rememberMe: false },
        validated: { email: 'u@test.com', password: 'Pass123!' },
      };
      const res = createRes();

      (User.findOne as jest.Mock).mockResolvedValue({
        _id: 'uid',
        provider: 'local',
        username: 'u1',
        email: 'u@test.com',
        password: 'hash',
        profilePicture: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await login(req, res);

      expect(RefreshToken.deleteMany).toHaveBeenCalled();
      expect(RefreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'refresh-token', rememberMe: false }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('refreshToken', () => {
    test('returns 401 when refresh token is missing', async () => {
      const req: any = { body: {} };
      const res = createRes();

      await refreshAccessToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 403 when jwt verify fails', async () => {
      const req: any = { body: { refreshToken: 'bad' } };
      const res = createRes();

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid');
      });

      await refreshAccessToken(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('returns 403 when token doc is not found', async () => {
      const req: any = { body: { refreshToken: 'old-token' } };
      const res = createRes();

      (jwt.verify as jest.Mock).mockReturnValue({ id: 'u1' });
      (RefreshToken.findOne as jest.Mock).mockResolvedValue(null);

      await refreshAccessToken(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid refresh token' });
    });

    test('returns 403 and deletes token when expired', async () => {
      const req: any = { body: { refreshToken: 'old-token' } };
      const res = createRes();

      (jwt.verify as jest.Mock).mockReturnValue({ id: 'u1' });
      (RefreshToken.findOne as jest.Mock).mockResolvedValue({
        rememberMe: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await refreshAccessToken(req, res);

      expect(RefreshToken.deleteOne).toHaveBeenCalledWith({ token: 'old-token' });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Refresh token has expired' });
    });

    test('returns 200 and rotates refresh token', async () => {
      const req: any = { body: { refreshToken: 'old-token' } };
      const res = createRes();

      (jwt.verify as jest.Mock).mockReturnValue({ id: 'u1' });
      (RefreshToken.findOne as jest.Mock).mockResolvedValue({
        rememberMe: true,
        expiresAt: new Date(Date.now() + 60_000),
      });
      (User.findById as jest.Mock).mockResolvedValue({ _id: 'u1', username: 'u1', email: 'u@test.com' });

      await refreshAccessToken(req, res);

      expect(RefreshToken.deleteOne).toHaveBeenCalledWith({ token: 'old-token' });
      expect(RefreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'refresh-token', rememberMe: true }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });
  });

  describe('logout', () => {
    test('returns 400 when refresh token is missing', async () => {
      const req: any = { body: {} };
      const res = createRes();

      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Refresh token required' });
    });

    test('returns 200 and deletes refresh token', async () => {
      const req: any = { body: { refreshToken: 'token' } };
      const res = createRes();

      await logout(req, res);

      expect(RefreshToken.deleteOne).toHaveBeenCalledWith({ token: 'token' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});

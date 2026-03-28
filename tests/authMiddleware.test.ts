import jwt from 'jsonwebtoken';
import { optionalVerifyToken, verifyToken } from '../src/middleware/authMiddleware';
import { createMockResponse } from './helpers/httpMocks';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyToken', () => {
    test('returns 401 when authorization header is missing', () => {
      const req: any = { headers: {} };
      const res = createMockResponse();
      const next = jest.fn();

      verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Authorization header missing or malformed' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when authorization header is malformed', () => {
      const req: any = { headers: { authorization: 'Token abc' } };
      const res = createMockResponse();
      const next = jest.fn();

      verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when bearer token is empty', () => {
      const req: any = { headers: { authorization: 'Bearer ' } };
      const res = createMockResponse();
      const next = jest.fn();

      verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 403 for invalid token', () => {
      const req: any = { headers: { authorization: 'Bearer bad-token' } };
      const res = createMockResponse();
      const next = jest.fn();

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid');
      });

      verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('sets req.user and calls next for valid token', () => {
      const req: any = { headers: { authorization: 'Bearer good-token' } };
      const res = createMockResponse();
      const next = jest.fn();

      (jwt.verify as jest.Mock).mockReturnValue({ id: 'u1' });

      verifyToken(req, res, next);

      expect(req.user).toEqual({ id: 'u1' });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalVerifyToken', () => {
    test('continues without user when header is missing', () => {
      const req: any = { headers: {} };
      const next = jest.fn();

      optionalVerifyToken(req, {} as any, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(jwt.verify).not.toHaveBeenCalled();
    });

    test('continues without user when token is invalid', () => {
      const req: any = { headers: { authorization: 'Bearer bad-token' } };
      const next = jest.fn();

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('bad');
      });

      optionalVerifyToken(req, {} as any, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    test('sets req.user when token is valid', () => {
      const req: any = { headers: { authorization: 'Bearer good-token' } };
      const next = jest.fn();

      (jwt.verify as jest.Mock).mockReturnValue({ id: 'u2' });

      optionalVerifyToken(req, {} as any, next);

      expect(req.user).toEqual({ id: 'u2' });
      expect(next).toHaveBeenCalled();
    });
  });
});

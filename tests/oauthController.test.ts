import jwt from 'jsonwebtoken';
import {
  facebookCallback,
  facebookRedirect,
  googleCallback,
  googleRedirect,
} from '../src/controllers/oauthController';
import User from '../src/models/userModel';
import RefreshToken from '../src/models/refreshTokenModel';
import * as oauthService from '../src/services/oauthService';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

jest.mock('../src/models/userModel', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../src/models/refreshTokenModel', () => ({
  __esModule: true,
  default: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../src/services/oauthService', () => ({
  getGoogleAuthUrl: jest.fn(),
  exchangeGoogleCode: jest.fn(),
  getFacebookAuthUrl: jest.fn(),
  exchangeFacebookCode: jest.fn(),
  verifyStateToken: jest.fn(),
}));

function createRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
}

describe('oauthController', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.CLIENT_ORIGIN = 'http://localhost:5173';
    (oauthService.verifyStateToken as jest.Mock).mockImplementation(() => undefined);
    (jwt.sign as jest.Mock).mockImplementation((payload: any) =>
      payload?.username ? 'access-token' : 'refresh-token',
    );
  });

  test('googleRedirect sends provider URL', () => {
    const res = createRes();
    (oauthService.getGoogleAuthUrl as jest.Mock).mockReturnValue('https://google.auth/url');

    googleRedirect({} as any, res);

    expect(res.redirect).toHaveBeenCalledWith('https://google.auth/url');
  });

  test('googleCallback returns 400 when state is missing', async () => {
    const req: any = { query: { code: 'abc' } };
    const res = createRes();

    await googleCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing state parameter' });
  });

  test('googleCallback returns 400 when code is missing', async () => {
    const req: any = { query: { state: 'state123' } };
    const res = createRes();

    await googleCallback(req, res);

    expect(oauthService.verifyStateToken).toHaveBeenCalledWith('state123');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing authorization code' });
  });

  test('googleCallback returns 500 when state validation fails', async () => {
    const req: any = { query: { state: 'bad', code: 'abc' } };
    const res = createRes();

    (oauthService.verifyStateToken as jest.Mock).mockImplementation(() => {
      throw new Error('invalid state');
    });

    await googleCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Google authentication failed' });
  });

  test('googleCallback reuses existing provider user and redirects with tokens', async () => {
    const req: any = { query: { state: 'ok', code: 'abc' } };
    const res = createRes();

    (oauthService.exchangeGoogleCode as jest.Mock).mockResolvedValue({
      providerId: 'g-1',
      email: 'u@test.com',
      username: 'User 1',
      profilePicture: 'https://pic',
    });

    (User.findOne as jest.Mock).mockResolvedValue({
      _id: 'u1',
      username: 'User 1',
      email: 'u@test.com',
      profilePicture: 'https://pic',
    });

    await googleCallback(req, res);

    expect(RefreshToken.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    expect(RefreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'refresh-token', rememberMe: true }),
    );
    expect(res.redirect).toHaveBeenCalled();
    const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0] as string;
    expect(redirectUrl).toContain('http://localhost:5173/auth/callback');
    expect(redirectUrl).toContain('accessToken=access-token');
    expect(redirectUrl).toContain('refreshToken=refresh-token');
  });

  test('googleCallback creates new oauth user when no existing user found', async () => {
    const req: any = { query: { state: 'ok', code: 'abc' } };
    const res = createRes();

    (oauthService.exchangeGoogleCode as jest.Mock).mockResolvedValue({
      providerId: 'g-2',
      email: 'new@test.com',
      username: 'New User',
      profilePicture: undefined,
    });

    (User.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    (User.create as jest.Mock).mockResolvedValue({
      _id: 'u2',
      username: 'New User',
      email: 'new@test.com',
    });

    await googleCallback(req, res);

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google', providerId: 'g-2' }),
    );
    expect(res.redirect).toHaveBeenCalled();
  });

  test('facebookRedirect sends provider URL', () => {
    const res = createRes();
    (oauthService.getFacebookAuthUrl as jest.Mock).mockReturnValue('https://facebook.auth/url');

    facebookRedirect({} as any, res);

    expect(res.redirect).toHaveBeenCalledWith('https://facebook.auth/url');
  });

  test('facebookCallback returns 400 when state is missing', async () => {
    const req: any = { query: { code: 'abc' } };
    const res = createRes();

    await facebookCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing state parameter' });
  });

  test('facebookCallback success redirects with tokens', async () => {
    const req: any = { query: { state: 'ok', code: 'abc' } };
    const res = createRes();

    (oauthService.exchangeFacebookCode as jest.Mock).mockResolvedValue({
      providerId: 'fb-1',
      email: 'fb@test.com',
      username: 'FB User',
      profilePicture: undefined,
    });

    (User.findOne as jest.Mock).mockResolvedValue({
      _id: 'u3',
      username: 'FB User',
      email: 'fb@test.com',
    });

    await facebookCallback(req, res);

    expect(RefreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'refresh-token', rememberMe: true }),
    );
    expect(res.redirect).toHaveBeenCalled();
  });
});

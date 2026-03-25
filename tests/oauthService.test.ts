import axios from 'axios';
import jwt from 'jsonwebtoken';
import {
  exchangeFacebookCode,
  exchangeGoogleCode,
  generateStateToken,
  getFacebookAuthUrl,
  getGoogleAuthUrl,
  verifyStateToken,
} from '../src/services/oauthService';
import { googleOAuthClient } from '../src/config/oauthClients';

jest.mock('axios');
jest.mock('jsonwebtoken');
jest.mock('../src/config/oauthClients', () => ({
  googleOAuthClient: {
    generateAuthUrl: jest.fn(),
    getToken: jest.fn(),
    setCredentials: jest.fn(),
    verifyIdToken: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;
const mockedGoogle = googleOAuthClient as unknown as {
  generateAuthUrl: jest.Mock;
  getToken: jest.Mock;
  setCredentials: jest.Mock;
  verifyIdToken: jest.Mock;
};

describe('oauthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedJwt.sign.mockReturnValue('state-token' as any);
  });

  test('generateStateToken calls jwt.sign', () => {
    const token = generateStateToken();
    expect(token).toBe('state-token');
    expect(mockedJwt.sign).toHaveBeenCalled();
  });

  test('verifyStateToken calls jwt.verify', () => {
    mockedJwt.verify.mockReturnValue({} as any);
    verifyStateToken('state-token');
    expect(mockedJwt.verify).toHaveBeenCalledWith(expect.any(String), expect.any(String));
  });

  test('getGoogleAuthUrl builds URL with generated state', () => {
    mockedGoogle.generateAuthUrl.mockReturnValue('https://google-auth-url');

    const url = getGoogleAuthUrl();

    expect(url).toBe('https://google-auth-url');
    expect(mockedGoogle.generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'state-token' }),
    );
  });

  test('exchangeGoogleCode throws when id_token is missing', async () => {
    mockedGoogle.getToken.mockResolvedValue({ tokens: {} });

    await expect(exchangeGoogleCode('code')).rejects.toThrow('No ID token returned from Google');
  });

  test('exchangeGoogleCode throws on invalid payload', async () => {
    mockedGoogle.getToken.mockResolvedValue({ tokens: { id_token: 'id-token' } });
    mockedGoogle.verifyIdToken.mockResolvedValue({ getPayload: () => ({}) });

    await expect(exchangeGoogleCode('code')).rejects.toThrow('Invalid Google ID token payload');
  });

  test('exchangeGoogleCode maps valid payload and normalizes picture size', async () => {
    mockedGoogle.getToken.mockResolvedValue({ tokens: { id_token: 'id-token' } });
    mockedGoogle.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-1',
        email: 'u@test.com',
        name: 'User Name',
        picture: 'https://x/y=s96-c',
      }),
    });

    const profile = await exchangeGoogleCode('code');

    expect(profile).toEqual({
      providerId: 'google-1',
      email: 'u@test.com',
      username: 'User Name',
      profilePicture: 'https://x/y=s400-c',
    });
  });

  test('getFacebookAuthUrl includes required params', () => {
    const url = getFacebookAuthUrl();
    expect(url).toContain('facebook.com');
    expect(url).toContain('response_type=code');
    expect(url).toContain('state=state-token');
  });

  test('exchangeFacebookCode throws when profile id is missing', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { access_token: 'token' } } as any)
      .mockResolvedValueOnce({ data: {} } as any);

    await expect(exchangeFacebookCode('code')).rejects.toThrow('Invalid Facebook profile response');
  });

  test('exchangeFacebookCode maps profile and falls back email when missing', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { access_token: 'token' } } as any)
      .mockResolvedValueOnce({
        data: {
          id: 'fb-1',
          name: 'FB User',
          picture: { data: { url: 'https://fb/pic.jpg' } },
        },
      } as any);

    const profile = await exchangeFacebookCode('code');

    expect(profile).toEqual({
      providerId: 'fb-1',
      email: 'fb_fb-1@noemail.local',
      username: 'FB User',
      profilePicture: 'https://fb/pic.jpg',
    });
  });
});

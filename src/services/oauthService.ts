import jwt from 'jsonwebtoken';
import axios from 'axios';
import { googleOAuthClient } from '../config/oauthClients';
import { oauthConfig } from '../config/auth';

// ─── CSRF State Token (stateless, no session needed) ─────────────────────────

export const generateStateToken = (): string => {
  return jwt.sign({ csrf: true }, oauthConfig.stateSecret, { expiresIn: 60 }); // 1 minute
};

export const verifyStateToken = (state: string): void => {
  jwt.verify(state, oauthConfig.stateSecret); // throws on invalid / expired
};

// ─── Google ───────────────────────────────────────────────────────────────────

export interface OAuthProfile {
  providerId: string;
  email: string;
  username: string;
  profilePicture?: string;
}

export const getGoogleAuthUrl = (): string => {
  const state = generateStateToken();
  return googleOAuthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
  });
};

export const exchangeGoogleCode = async (code: string): Promise<OAuthProfile> => {
  const { tokens } = await googleOAuthClient.getToken(code);
  googleOAuthClient.setCredentials(tokens);

  if (!tokens.id_token) {
    throw new Error('No ID token returned from Google');
  }

  const ticket = await googleOAuthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: oauthConfig.google.clientId,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Invalid Google ID token payload');
  }

  return {
    providerId: payload.sub,
    email: payload.email,
    username: payload.name || payload.email.split('@')[0],
    profilePicture: payload.picture
      ? payload.picture.replace(/=s\d+-c$/, '=s400-c')
      : undefined,
  };
};

// ─── Facebook ─────────────────────────────────────────────────────────────────

export const getFacebookAuthUrl = (): string => {
  const state = generateStateToken();
  const params = new URLSearchParams({
    client_id: oauthConfig.facebook.appId,
    redirect_uri: oauthConfig.facebook.callbackUrl,
    scope: 'email',
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
};

export const exchangeFacebookCode = async (code: string): Promise<OAuthProfile> => {
  // Step 1 — exchange code for access token
  const tokenResponse = await axios.get<{ access_token: string }>(
    'https://graph.facebook.com/v18.0/oauth/access_token',
    {
      params: {
        client_id: oauthConfig.facebook.appId,
        client_secret: oauthConfig.facebook.appSecret,
        redirect_uri: oauthConfig.facebook.callbackUrl,
        code,
      },
    }
  );

  const accessToken = tokenResponse.data.access_token;

  // Step 2 — fetch user profile
  const profileResponse = await axios.get<{
    id: string;
    email?: string;
    name?: string;
    picture?: { data?: { url?: string } };
  }>('https://graph.facebook.com/me', {
    params: {
      fields: 'id,email,name,picture.type(large)',
      access_token: accessToken,
    },
  });

  const profile = profileResponse.data;
  if (!profile.id) {
    throw new Error('Invalid Facebook profile response');
  }

  // Facebook does not always return an email (e.g. phone-only accounts)
  const email = profile.email ?? `fb_${profile.id}@noemail.local`;

  return {
    providerId: profile.id,
    email,
    username: profile.name || `fb_${profile.id}`,
    profilePicture: profile.picture?.data?.url,
  };
};

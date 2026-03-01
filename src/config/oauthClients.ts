import { OAuth2Client } from 'google-auth-library';
import { oauthConfig } from './auth';

export const googleOAuthClient = new OAuth2Client(
  oauthConfig.google.clientId,
  oauthConfig.google.clientSecret,
  oauthConfig.google.callbackUrl
);

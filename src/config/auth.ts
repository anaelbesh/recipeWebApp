const accessExpiresIn = parseInt(process.env.JWT_ACCESS_EXPIRATION || "3600", 10);   
const refreshExpiresIn = parseInt(process.env.JWT_REFRESH_EXPIRATION || "604800", 10);
const rememberMeExpiresIn = parseInt(process.env.JWT_REMEMBER_ME_EXPIRATION || "2592000", 10); // 30 days

export const authConfig = {
  accessTokenSecret: process.env.JWT_SECRET || "default_secret_key",
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || "default_refresh_secret_key",
  accessTokenTtl: accessExpiresIn,                    
  refreshTokenTtl: refreshExpiresIn,                   
  refreshTokenTtlMs: refreshExpiresIn * 1000,          
  refreshTokenTtlSeconds: refreshExpiresIn,
  rememberMeTtl: rememberMeExpiresIn,
  rememberMeTtlMs: rememberMeExpiresIn * 1000,            
  isProduction: process.env.NODE_ENV === "production",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
};

export const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackUrl: `${process.env.OAUTH_CALLBACK_BASE_URL || "http://localhost:3000"}/api/auth/google/callback`,
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID || "",
    appSecret: process.env.FACEBOOK_APP_SECRET || "",
    callbackUrl: `${process.env.OAUTH_CALLBACK_BASE_URL || "http://localhost:3000"}/api/auth/facebook/callback`,
  },
  stateSecret: process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || "default_state_secret",
};

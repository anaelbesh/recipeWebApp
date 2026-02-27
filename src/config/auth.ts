const accessExpiresIn = parseInt(process.env.JWT_ACCESS_EXPIRATION || "3600", 10);   
const refreshExpiresIn = parseInt(process.env.JWT_REFRESH_EXPIRATION || "604800", 10); 

export const authConfig = {
  accessTokenSecret: process.env.JWT_SECRET || "default_secret_key",
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || "default_refresh_secret_key",
  accessTokenTtl: accessExpiresIn,                    
  refreshTokenTtl: refreshExpiresIn,                   
  refreshTokenTtlMs: refreshExpiresIn * 1000,          
  refreshTokenTtlSeconds: refreshExpiresIn,            
  isProduction: process.env.NODE_ENV === "production",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
};

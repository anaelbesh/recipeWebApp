import request from "supertest";
import mongoose from "mongoose";
import { app } from "../src/server";
import User from "../src/models/userModel";
import RefreshToken from "../src/models/refreshTokenModel";
import { connectMongo } from "../src/db";
import { userData } from "./utils";
import * as oauthService from "../src/services/oauthService";

const ALL_TEST_EMAILS = [
  userData.email,
  "oauthgoogle@test.com",
  "mockgoogle@test.com",
  "mockfacebook@test.com",
  "mergetest@test.com",
  "providercheck@test.com",
];

beforeAll(async () => {
  await connectMongo();
  const testUsers = await User.find({ email: { $in: ALL_TEST_EMAILS } });
  const testIds = testUsers.map((u) => u._id);
  if (testIds.length) await RefreshToken.deleteMany({ userId: { $in: testIds } });
  await User.deleteMany({ email: { $in: ALL_TEST_EMAILS } });
  // Also clean up any leftover doubletest users from previous runs
  await User.deleteMany({ email: /^doubletest/ });
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("Test Auth Suite", () => {

  test("Register without required fields", async () => {
    const response = await request(app).post("/api/auth/register").send({ email: "test@test.com" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('All fields are required');
  });

  test("Test Registration", async () => {
    const { email, username, password } = userData;
    const response = await request(app).post("/api/auth/register").send(
      { email, username, password }
    );
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");
    expect(response.body.user).toHaveProperty("id");
    userData.accessToken = response.body.accessToken;
    userData.refreshToken = response.body.refreshToken;
    userData._id = response.body.user.id;
  });

  test("Register duplicate user fails", async () => {
    const { email, username, password } = userData;
    const response = await request(app).post("/api/auth/register").send(
      { email, username, password }
    );
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('User already exists');
  });

  test("Test Login", async () => {
    const { email, password } = userData;
    const response = await request(app).post("/api/auth/login").send(
      { email, password }
    );
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");
    expect(response.body.user).toHaveProperty("id");
    userData.accessToken = response.body.accessToken;
    userData.refreshToken = response.body.refreshToken;
  });

  test("Login with incorrect password", async () => {
    const response = await request(app).post("/api/auth/login")
      .send({ email: userData.email, password: "wrongpassword" });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials');
  });

  test("Login with non-existent user", async () => {
    const response = await request(app).post("/api/auth/login")
      .send({ email: "nonexistent@test.com", password: "password" });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials');
  });

  test("Login without email", async () => {
    const response = await request(app).post("/api/auth/login")
      .send({ password: "password" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Email and password are required');
  });

  test("Login without password", async () => {
    const response = await request(app).post("/api/auth/login")
      .send({ email: "test@test.com" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Email and password are required');
  });

  test("Test Refresh Token", async () => {
    const response = await request(app).post("/api/auth/refresh").send(
      { refreshToken: userData.refreshToken }
    );
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");
    userData.accessToken = response.body.accessToken;
    userData.refreshToken = response.body.refreshToken;
  });

  test("Test double use of refresh token fails", async () => {
    const randomId = Date.now();
    const freshUser = {
      email: `doubletest${randomId}@test.com`,
      username: `doubletest${randomId}`,
      password: "testpass"
    };
    
    const registerResponse = await request(app).post("/api/auth/register").send(freshUser);
    const originalRefreshToken = registerResponse.body.refreshToken;

    const refreshResponse1 = await request(app).post("/api/auth/refresh").send(
      { refreshToken: originalRefreshToken }
    );
    expect(refreshResponse1.status).toBe(200);
    expect(refreshResponse1.body).toHaveProperty("accessToken");
    expect(refreshResponse1.body).toHaveProperty("refreshToken");

    const refreshResponse2 = await request(app).post("/api/auth/refresh").send(
      { refreshToken: originalRefreshToken }
    );
    expect(refreshResponse2.status).toBe(403);
    expect(refreshResponse2.body.message).toBe('Invalid refresh token');
  });

  test("Refresh without refresh token", async () => {
    const response = await request(app).post("/api/auth/refresh")
      .send({});
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Refresh token required');
  });

  test("Refresh with invalid token", async () => {
    const response = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: "invalid-token-12345" });
    expect(response.status).toBe(403);
  });

  test("Logout without refresh token", async () => {
    const response = await request(app).post("/api/auth/logout")
      .set("Authorization", `Bearer ${userData.accessToken}`)
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Refresh token required');
  });

  test("Logout successfully", async () => {
    const response = await request(app).post("/api/auth/logout")
      .set("Authorization", `Bearer ${userData.accessToken}`)
      .send({ refreshToken: userData.refreshToken });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Logout successful');
  });

  test("Refresh after logout fails", async () => {
    const response = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: userData.refreshToken });
    expect(response.status).toBe(403);
  });

  test("Login with OAuth account returns 400", async () => {
    // Create a Google OAuth user directly in the DB
    const oauthUser = await User.create({
      username: "oauthgoogleuser",
      email: "oauthgoogle@test.com",
      provider: "google",
      providerId: "google_123456",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: oauthUser.email,
      password: "anypassword",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("google");
  });

  // ═══════════════════  REMEMBER ME TESTS  ═══════════════════
  test("Login with rememberMe: true stores rememberMe flag in DB", async () => {
    const rememberMeUser = {
      email: `rememberme${Date.now()}@test.com`,
      username: `rememberme${Date.now()}`,
      password: "testpass123",
    };

    // First register the user
    const registerResponse = await request(app).post("/api/auth/register").send(rememberMeUser);
    expect(registerResponse.status).toBe(201);

    // Then log in with rememberMe
    const loginResponse = await request(app).post("/api/auth/login")
      .send({ email: rememberMeUser.email, password: rememberMeUser.password, rememberMe: true });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty("accessToken");
    expect(loginResponse.body).toHaveProperty("refreshToken");

    // Verify in DB that rememberMe flag is set
    const tokenDoc = await RefreshToken.findOne({ token: loginResponse.body.refreshToken });
    expect(tokenDoc).not.toBeNull();
    expect(tokenDoc!.rememberMe).toBe(true);
  });

  test("Login without rememberMe (default) does not set rememberMe flag", async () => {
    const defaultUser = {
      email: `defaultlogin${Date.now()}@test.com`,
      username: `defaultlogin${Date.now()}`,
      password: "testpass123",
    };

    // Register the user
    await request(app).post("/api/auth/register").send(defaultUser);

    // Log in WITHOUT rememberMe
    const loginResponse = await request(app).post("/api/auth/login")
      .send({ email: defaultUser.email, password: defaultUser.password });

    expect(loginResponse.status).toBe(200);

    // Verify in DB that rememberMe flag is false (default)
    const tokenDoc = await RefreshToken.findOne({ token: loginResponse.body.refreshToken });
    expect(tokenDoc).not.toBeNull();
    expect(tokenDoc!.rememberMe).toBe(false);
  });

  test("Register with rememberMe: true works", async () => {
    const regRememberMeUser = {
      email: `registerrememberme${Date.now()}@test.com`,
      username: `registerrememberme${Date.now()}`,
      password: "testpass123",
      rememberMe: true,
    };

    const response = await request(app).post("/api/auth/register").send(regRememberMeUser);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");

    // Verify in DB that rememberMe flag is set
    const tokenDoc = await RefreshToken.findOne({ token: response.body.refreshToken });
    expect(tokenDoc).not.toBeNull();
    expect(tokenDoc!.rememberMe).toBe(true);
  });

  test("Refresh token preserves rememberMe flag on rotation", async () => {
    const rememberMeUser = {
      email: `refreshrememberme${Date.now()}@test.com`,
      username: `refreshrememberme${Date.now()}`,
      password: "testpass123",
    };

    // Register with rememberMe
    const registerResponse = await request(app).post("/api/auth/register")
      .send({ ...rememberMeUser, rememberMe: true });

    const initialRefreshToken = registerResponse.body.refreshToken;

    // Verify initial token has rememberMe: true
    const initialTokenDoc = await RefreshToken.findOne({ token: initialRefreshToken });
    expect(initialTokenDoc!.rememberMe).toBe(true);

    // Now refresh
    const refreshResponse = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: initialRefreshToken });

    expect(refreshResponse.status).toBe(200);

    // Verify new token also has rememberMe: true (preserved)
    const newRefreshToken = refreshResponse.body.refreshToken;
    const newTokenDoc = await RefreshToken.findOne({ token: newRefreshToken });
    expect(newTokenDoc).not.toBeNull();
    expect(newTokenDoc!.rememberMe).toBe(true);
  });

  test("Expired refresh token (rememberMe or not) fails", async () => {
    const expiredUser = {
      email: `expiredtoken${Date.now()}@test.com`,
      username: `expiredtoken${Date.now()}`,
      password: "testpass123",
    };

    const registerResponse = await request(app).post("/api/auth/register").send(expiredUser);
    const refreshToken = registerResponse.body.refreshToken;

    // Manually set expiresAt to the past in the DB
    await RefreshToken.findOneAndUpdate(
      { token: refreshToken },
      { expiresAt: new Date(Date.now() - 5000) } // 5 seconds ago
    );

    // Try to refresh with expired token
    const response = await request(app).post("/api/auth/refresh")
      .send({ refreshToken });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("expired");
  });
});

describe("Test OAuth Suite", () => {

  test("GET /api/auth/google redirects to Google consent screen", async () => {
    const response = await request(app).get("/api/auth/google");
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("accounts.google.com");
  });

  test("GET /api/auth/facebook redirects to Facebook login dialog", async () => {
    const response = await request(app).get("/api/auth/facebook");
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("facebook.com");
  });

  test("Google callback without state returns 400", async () => {
    const response = await request(app).get("/api/auth/google/callback?code=fakecode");
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Missing state parameter");
  });

  test("Google callback without code returns 400", async () => {
    const state = oauthService.generateStateToken();
    const response = await request(app).get(`/api/auth/google/callback?state=${state}`);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Missing authorization code");
  });

  test("Google callback with invalid state returns 500", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const response = await request(app).get(
      "/api/auth/google/callback?code=fakecode&state=invalid_state_token"
    );
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Google authentication failed");
    consoleSpy.mockRestore();
  });

  test("Facebook callback without state returns 400", async () => {
    const response = await request(app).get("/api/auth/facebook/callback?code=fakecode");
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Missing state parameter");
  });

  test("Facebook callback without code returns 400", async () => {
    const state = oauthService.generateStateToken();
    const response = await request(app).get(`/api/auth/facebook/callback?state=${state}`);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Missing authorization code");
  });

  test("Facebook callback with invalid state returns 500", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const response = await request(app).get(
      "/api/auth/facebook/callback?code=fakecode&state=invalid_state_token"
    );
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Facebook authentication failed");
    consoleSpy.mockRestore();
  });

  test("Google callback with valid state + mocked exchange creates user and redirects", async () => {
    const state = oauthService.generateStateToken();

    // Mock the Google code exchange to return a fake profile
    const spy = jest.spyOn(oauthService, "exchangeGoogleCode").mockResolvedValueOnce({
      providerId: "google_mock_999",
      email: "mockgoogle@test.com",
      username: "Mock Google User",
      profilePicture: "https://example.com/photo.jpg",
    });

    const response = await request(app).get(
      `/api/auth/google/callback?code=mock_auth_code&state=${state}`
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("accessToken");
    expect(response.headers.location).toContain("refreshToken");

    // Verify the user was created in the DB
    const user = await User.findOne({ email: "mockgoogle@test.com" });
    expect(user).not.toBeNull();
    expect(user!.provider).toBe("google");
    expect(user!.providerId).toBe("google_mock_999");
    expect(user!.profilePicture).toBe("https://example.com/photo.jpg");

    spy.mockRestore();
  });

  test("Facebook callback with valid state + mocked exchange creates user and redirects", async () => {
    const state = oauthService.generateStateToken();

    const spy = jest.spyOn(oauthService, "exchangeFacebookCode").mockResolvedValueOnce({
      providerId: "fb_mock_888",
      email: "mockfacebook@test.com",
      username: "Mock Facebook User",
      profilePicture: "https://example.com/fbphoto.jpg",
    });

    const response = await request(app).get(
      `/api/auth/facebook/callback?code=mock_auth_code&state=${state}`
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("accessToken");
    expect(response.headers.location).toContain("refreshToken");

    const user = await User.findOne({ email: "mockfacebook@test.com" });
    expect(user).not.toBeNull();
    expect(user!.provider).toBe("facebook");
    expect(user!.providerId).toBe("fb_mock_888");

    spy.mockRestore();
  });

  test("OAuth account merge — existing local user gets linked to Google", async () => {
    // Create a local user first
    const existingUser = await User.create({
      username: "mergetest",
      email: "mergetest@test.com",
      password: "hashedpassword",
      provider: "local",
    });

    const state = oauthService.generateStateToken();

    const spy = jest.spyOn(oauthService, "exchangeGoogleCode").mockResolvedValueOnce({
      providerId: "google_merge_777",
      email: "mergetest@test.com",    // same email as existing local user
      username: "Merge Test Google",
      profilePicture: "https://example.com/merge.jpg",
    });

    const response = await request(app).get(
      `/api/auth/google/callback?code=mock_auth_code&state=${state}`
    );

    expect(response.status).toBe(302);

    // Verify the user was merged (no new user created)
    const usersWithEmail = await User.find({ email: "mergetest@test.com" });
    expect(usersWithEmail).toHaveLength(1);
    expect(usersWithEmail[0]._id.toString()).toBe(existingUser._id.toString());
    expect(usersWithEmail[0].provider).toBe("google");
    expect(usersWithEmail[0].providerId).toBe("google_merge_777");

    spy.mockRestore();
  });

  test("Returning OAuth user reuses existing account", async () => {
    const state = oauthService.generateStateToken();

    const spy = jest.spyOn(oauthService, "exchangeGoogleCode").mockResolvedValueOnce({
      providerId: "google_mock_999",      // same as the user created above
      email: "mockgoogle@test.com",
      username: "Mock Google User",
    });

    const response = await request(app).get(
      `/api/auth/google/callback?code=mock_auth_code&state=${state}`
    );

    expect(response.status).toBe(302);

    // Only one user should exist with this providerId
    const users = await User.find({ providerId: "google_mock_999" });
    expect(users).toHaveLength(1);

    spy.mockRestore();
  });

  test("Registered user has provider field set to local", async () => {
    const regResponse = await request(app).post("/api/auth/register").send({
      username: "providercheckuser",
      email: "providercheck@test.com",
      password: "testpass123",
    });
    expect(regResponse.status).toBe(201);

    const user = await User.findOne({ email: "providercheck@test.com" });
    expect(user).not.toBeNull();
    expect(user!.provider).toBe("local");
  });
});


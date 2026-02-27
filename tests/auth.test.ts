import request from "supertest";
import mongoose from "mongoose";
import { app } from "../src/server";
import User from "../src/models/userModel";
import RefreshToken from "../src/models/refreshTokenModel";
import { connectMongo } from "../src/db";
import { userData } from "./utils";

beforeAll(async () => {
  await connectMongo();
  await User.deleteMany();
  await RefreshToken.deleteMany();
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
    const response = await request(app).post("/api/auth/logout").send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Refresh token required');
  });

  test("Logout successfully", async () => {
    const response = await request(app).post("/api/auth/logout")
      .send({ refreshToken: userData.refreshToken });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Logout successful');
  });

  test("Refresh after logout fails", async () => {
    const response = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: userData.refreshToken });
    expect(response.status).toBe(403);
  });
});


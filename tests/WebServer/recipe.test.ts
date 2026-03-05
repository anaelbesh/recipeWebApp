import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/server";
import { Comment } from "../../src/models/Comment";
import { Like } from "../../src/models/Like";
import User from "../../src/models/userModel";
import RefreshToken from "../../src/models/refreshTokenModel";
import { connectMongo } from "../../src/db";

let accessToken: string;
const dummyRecipeId = new mongoose.Types.ObjectId().toString();

describe("Recipe API Integration Tests", () => {
    beforeAll(async () => {
        await connectMongo();
        // Clean up and register a test user to get a valid JWT
        const testUser = await User.findOne({ email: "recipe_test@test.com" });
        if (testUser) await RefreshToken.deleteMany({ userId: testUser._id });
        await User.deleteMany({ email: "recipe_test@test.com" });
        const res = await request(app).post("/api/auth/register").send({
            email: "recipe_test@test.com",
            username: "recipe_testuser",
            password: "testpass123",
        });
        accessToken = res.body.accessToken;
    });

    afterAll(async () => {
        await User.deleteMany({ email: "recipe_test@test.com" });
        await mongoose.disconnect();
    });

    describe("POST /api/recipes/:recipeId/comments", () => {
        it("should create a new comment successfully", async () => {
            const res = await request(app)
                .post(`/api/recipes/${dummyRecipeId}/comments`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ content: "This is a JIT (Jest) integrated test comment!" });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("_id");
            expect(res.body.content).toBe("This is a JIT (Jest) integrated test comment!");

            const savedComment = await Comment.findById(res.body._id);
            expect(savedComment).not.toBeNull();
        });

        it("should return 401 without a token", async () => {
            const res = await request(app)
                .post(`/api/recipes/${dummyRecipeId}/comments`)
                .send({ content: "No token" });
            expect(res.status).toBe(401);
        });

        it("should return 400 if content is missing", async () => {
            const res = await request(app)
                .post(`/api/recipes/${dummyRecipeId}/comments`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Comment content is required");
        });
    });

    describe("POST /api/recipes/:recipeId/likes", () => {
        it("should toggle like (add and then remove)", async () => {
            // First call: Add like
            const addRes = await request(app)
                .post(`/api/recipes/${dummyRecipeId}/likes`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({});

            expect(addRes.status).toBe(201);
            expect(addRes.body.liked).toBe(true);

            // Second call: Remove like
            const removeRes = await request(app)
                .post(`/api/recipes/${dummyRecipeId}/likes`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({});

            expect(removeRes.status).toBe(200);
            expect(removeRes.body.liked).toBe(false);
        });

        it("should return 401 without a token", async () => {
            const res = await request(app)
                .post(`/api/recipes/${dummyRecipeId}/likes`)
                .send({});
            expect(res.status).toBe(401);
        });
    });
});

import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/server";
import { Comment } from "../../src/models/Comment";
import User from "../../src/models/userModel";
import RefreshToken from "../../src/models/refreshTokenModel";
import { connectMongo } from "../../src/db";
import { Recipe } from "../../src/models/Recipe";

let accessToken: string;
let testRecipeId: string;
let testUserId: string;
let testCommentId: string;

describe("Comment API Integration Tests", () => {
    beforeAll(async () => {
        await connectMongo();
        const testUser = await User.findOne({ email: "comment_test@test.com" });
        if (testUser) {
            testUserId = testUser._id.toString();
            await RefreshToken.deleteMany({ userId: testUser._id });
        }
        await User.deleteMany({ email: "comment_test@test.com" });
        const res = await request(app).post("/api/auth/register").send({
            email: "comment_test@test.com",
            username: "comment_testuser",
            password: "testpass123",
        });
        accessToken = res.body.accessToken;
        const user = await User.findOne({ email: "comment_test@test.com" });
        if (user) {
            testUserId = user._id.toString();
        }

        const testRecipe = new Recipe({
            title: "Test Recipe for Comments",
            description: "A recipe to test comments",
            ingredients: ["love", "happiness"],
            instructions: "Stir gently and enjoy the taste.",
            user: new mongoose.Types.ObjectId(testUserId),
            createdBy: new mongoose.Types.ObjectId(testUserId),
        });
        await testRecipe.save();
        testRecipeId = testRecipe._id.toString();
    });

    afterAll(async () => {
        await User.deleteMany({ email: "comment_test@test.com" });
        await Recipe.findByIdAndDelete(testRecipeId);
        await Comment.deleteMany({ user: new mongoose.Types.ObjectId(testUserId) });
        await mongoose.disconnect();
    });

    describe("POST /api/recipes/:recipeId/comments", () => {
        it("should create a new comment successfully", async () => {
            const res = await request(app)
                .post(`/api/recipes/${testRecipeId}/comments`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ content: "This is a test comment!" });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("_id");
            expect(res.body.content).toBe("This is a test comment!");
            testCommentId = res.body._id;

            const savedComment = await Comment.findById(testCommentId);
            expect(savedComment).not.toBeNull();
        });

        it("should return 401 without a token", async () => {
            const res = await request(app)
                .post(`/api/recipes/${testRecipeId}/comments`)
                .send({ content: "This should fail" });
            expect(res.status).toBe(401);
        });
    });

    describe("GET /api/recipes/:recipeId/comments", () => {
        it("should retrieve all comments for a recipe", async () => {
            const res = await request(app).get(`/api/recipes/${testRecipeId}/comments`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });
    });

    describe("PUT /api/comments/:commentId", () => {
        it("should update a comment successfully", async () => {
            const res = await request(app)
                .put(`/api/comments/${testCommentId}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ content: "This is an updated comment" });

            expect(res.status).toBe(200);
            expect(res.body.content).toBe("This is an updated comment");
        });

        it("should return 401 without a token", async () => {
            const res = await request(app)
                .put(`/api/comments/${testCommentId}`)
                .send({ content: "This should fail" });
            expect(res.status).toBe(401);
        });

        it("should return 403 when trying to update another user's comment", async () => {
            // Create another user and token
            const anotherUserRes = await request(app).post("/api/auth/register").send({
                email: "another_user@test.com",
                username: "anotheruser",
                password: "testpass123",
            });
            const anotherToken = anotherUserRes.body.accessToken;

            const res = await request(app)
                .put(`/api/comments/${testCommentId}`)
                .set("Authorization", `Bearer ${anotherToken}`)
                .send({ content: "This should fail" });
            expect(res.status).toBe(403);
            await User.deleteMany({ email: "another_user@test.com" });
        });
    });

    describe("DELETE /api/comments/:commentId", () => {
        it("should delete a comment successfully", async () => {
            const res = await request(app)
                .delete(`/api/comments/${testCommentId}`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message", "Comment deleted successfully");

            const deletedComment = await Comment.findById(testCommentId);
            expect(deletedComment).toBeNull();
        });

        it("should return 401 without a token", async () => {
            const res = await request(app).delete(`/api/comments/${testCommentId}`);
            expect(res.status).toBe(401);
        });
    });
});


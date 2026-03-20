import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/server";
import { Like } from "../../src/models/Like";
import User from "../../src/models/userModel";
import RefreshToken from "../../src/models/refreshTokenModel";
import { connectMongo } from "../../src/db";
import { Recipe } from "../../src/models/Recipe";

let accessToken: string;
let testRecipeId: string;
let testUserId: string;

describe("Like API Integration Tests", () => {
    beforeAll(async () => {
        await connectMongo();
        // Clean up and register a test user to get a valid JWT
        const testUser = await User.findOne({ email: "like_test@test.com" });
        if (testUser) {
            testUserId = testUser._id.toString();
            await RefreshToken.deleteMany({ userId: testUser._id });
        }
        await User.deleteMany({ email: "like_test@test.com" });
        const res = await request(app).post("/api/auth/register").send({
            email: "like_test@test.com",
            username: "like_testuser",
            password: "testpass123",
        });
        accessToken = res.body.accessToken;
        const user = await User.findOne({ email: "like_test@test.com" });
        if (user) {
            testUserId = user._id.toString();
        }

        const testRecipe = new Recipe({
            title: "Test Recipe for Likes",
            description: "A recipe to test likes",
            ingredients: ["sunshine", "rainbows"],
            instructions: "Mix well and enjoy this delicious meal!",
            user: new mongoose.Types.ObjectId(testUserId),
            createdBy: new mongoose.Types.ObjectId(testUserId),
        });
        await testRecipe.save();
        testRecipeId = testRecipe._id.toString();
    });

    afterAll(async () => {
        await User.deleteMany({ email: "like_test@test.com" });
        await Recipe.findByIdAndDelete(testRecipeId);
        await Like.deleteMany({ user: new mongoose.Types.ObjectId(testUserId) });
        await mongoose.disconnect();
    });

    describe("POST /api/recipes/:recipeId/likes", () => {
        afterEach(async () => {
            await Like.deleteMany({ user: new mongoose.Types.ObjectId(testUserId) });
        });

        it("should like a recipe successfully", async () => {
            const res = await request(app)
                .post(`/api/recipes/${testRecipeId}/likes`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("message", "Liked");
            expect(res.body).toHaveProperty("liked", true);

            const like = await Like.findOne({
                recipe: testRecipeId,
                user: testUserId,
            });
            expect(like).not.toBeNull();
        });

        it("should return 401 without a token", async () => {
            const res = await request(app).post(
                `/api/recipes/${testRecipeId}/likes`
            );
            expect(res.status).toBe(401);
        });

        it("should unlike a recipe successfully", async () => {
            // First like
            await request(app)
                .post(`/api/recipes/${testRecipeId}/likes`)
                .set("Authorization", `Bearer ${accessToken}`);
            // Second call to unlike
            const res = await request(app)
                .post(`/api/recipes/${testRecipeId}/likes`)
                .set("Authorization", `Bearer ${accessToken}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("message", "Unliked");
            expect(res.body).toHaveProperty("liked", false);

            const like = await Like.findOne({
                recipe: testRecipeId,
                user: testUserId,
            });
            expect(like).toBeNull();
        });
    });
});


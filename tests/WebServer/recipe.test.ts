import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/server";
import { Comment } from "../../src/models/Comment";
import { Like } from "../../src/models/Like";

describe("Recipe API Integration Tests", () => {
    const dummyRecipeId = new mongoose.Types.ObjectId().toString();
    const dummyUserId = new mongoose.Types.ObjectId().toString();

    // Clean up or setup before/after tests if needed
    afterAll(async () => {
        await mongoose.disconnect();
    });

    describe("POST /api/recipes/:recipeId/comments", () => {
        it("should create a new comment successfully", async () => {
            const res = await request(app)
                .post(`/api/recipes/${dummyRecipeId}/comments`)
                .send({
                    userId: dummyUserId,
                    content: "This is a JIT (Jest) integrated test comment!"
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty("_id");
            expect(res.body.content).toBe("This is a JIT (Jest) integrated test comment!");

            // Verify in MongoDB
            const savedComment = await Comment.findById(res.body._id);
            expect(savedComment).not.toBeNull();
        });

        it("should return 400 if content is missing", async () => {
            const res = await request(app)
                .post(`/api/recipes/${dummyRecipeId}/comments`)
                .send({ userId: dummyUserId });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Comment content is required");
        });
    });

    describe("POST /api/recipes/:recipeId/likes", () => {
        it("should toggle like (add and then remove)", async () => {
            // First call: Add like
            const addRes = await request(app)
                .post(`/api/recipes/${dummyRecipeId}/likes`)
                .send({ userId: dummyUserId });

            expect(addRes.status).toBe(201);
            expect(addRes.body.liked).toBe(true);

            // Verify in DB
            const likeInDb = await Like.findOne({ user: dummyUserId, recipe: dummyRecipeId });
            expect(likeInDb).not.toBeNull();

            // Second call: Remove like
            const removeRes = await request(app)
                .post(`/api/recipes/${dummyRecipeId}/likes`)
                .send({ userId: dummyUserId });

            expect(removeRes.status).toBe(200);
            expect(removeRes.body.liked).toBe(false);

            // Verify removed from DB
            const removedLike = await Like.findOne({ user: dummyUserId, recipe: dummyRecipeId });
            expect(removedLike).toBeNull();
        });
    });
});
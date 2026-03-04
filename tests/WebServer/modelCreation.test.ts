import "dotenv/config";
import mongoose from "mongoose";
import { Like } from "../../be/src/models/Like";
import { Comment } from "../../be/src/models/Comment";
import { connectMongo } from "../../be/src/db";

describe('Database Model Tests', () => {
    beforeAll(async () => {
        await connectMongo();
    });

    afterAll(async () => {
        await mongoose.disconnect();
    });

    it('should create a Like and a Comment successfully', async () => {
        const dummyUserId = new mongoose.Types.ObjectId();
        const dummyRecipeId = new mongoose.Types.ObjectId();

        // Test Like creation
        const newLike = await Like.create({
            user: dummyUserId,
            recipe: dummyRecipeId
        });
        expect(newLike).toBeDefined();
        expect(newLike.user).toEqual(dummyUserId);
        expect(newLike.recipe).toEqual(dummyRecipeId);

        // Test Comment creation
        const newComment = await Comment.create({
            user: dummyUserId,
            recipe: dummyRecipeId,
            content: "Wow, what a great recipe! It turned out delicious."
        });
        expect(newComment).toBeDefined();
        expect(newComment.user).toEqual(dummyUserId);
        expect(newComment.recipe).toEqual(dummyRecipeId);
        expect(newComment.content).toEqual("Wow, what a great recipe! It turned out delicious.");
    });

    it('should fail to create a duplicate Like', async () => {
        const dummyUserId = new mongoose.Types.ObjectId();
        const dummyRecipeId = new mongoose.Types.ObjectId();

        // Create the first like
        await Like.create({
            user: dummyUserId,
            recipe: dummyRecipeId
        });

        // Attempt to create a duplicate like and expect it to fail
        await expect(Like.create({
            user: dummyUserId,
            recipe: dummyRecipeId
        })).rejects.toThrow();
    });
});

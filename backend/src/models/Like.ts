import { Schema, model } from "mongoose";

const LikeSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipe: { type: Schema.Types.ObjectId, ref: "Recipe", required: true }
}, { timestamps: true });

// Dor - Blocks doing "Like" on the same post in the DB level, using an index.
LikeSchema.index({ user: 1, recipe: 1 }, { unique: true });

export const Like = model("Like", LikeSchema);
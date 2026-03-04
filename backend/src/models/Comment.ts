import { Schema, model } from "mongoose";

const CommentSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipe: { type: Schema.Types.ObjectId, ref: "Recipe", required: true },
    content: { type: String, required: true, trim: true },
}, { timestamps: true });

export const Comment = model("Comment", CommentSchema);
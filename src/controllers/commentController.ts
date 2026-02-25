import { Response } from "express";
import { Comment } from "../models/Comment";
import { AuthRequest } from "./common";

export const addComment = async (req: AuthRequest, res: Response) => {
    try {
        const { recipeId } = req.params;
        const { content } = req.body;

        // Dor's comment: we need to have this and use JWT:
        // const userId = req.user?._id;
        //
        // For testing purposes, I will support sending the user id from the URL
        // Remove this after we have JWT!
        const userId = req.user?._id || req.body.userId;

        if (!content) {
            return res.status(400).json({ message: "Comment content is required" });
        }

        const newComment = await Comment.create({
            user: userId,
            recipe: recipeId,
            content: content
        });

        res.status(201).json(newComment);
    } catch (error: any) {
        res.status(500).json({ message: "Error adding comment", error: error.message });
    }
};
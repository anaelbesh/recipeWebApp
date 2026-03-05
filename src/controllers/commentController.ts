import { Response } from "express";
import { Comment } from "../models/Comment";
import { AuthRequest } from "./common";

export const addComment = async (req: AuthRequest, res: Response) => {
    try {
        const { recipeId } = req.params;
        const { content } = req.body;

        // userId comes from the verified JWT token
        const userId = req.user?.id;

        if (!content) {
            return res.status(400).json({ message: "Comment content is required" });
        }

        const newComment = await Comment.create({
            user: userId,
            recipe: recipeId as string,
            content: content
        });

        res.status(201).json(newComment);
    } catch (error: any) {
        res.status(500).json({ message: "Error adding comment", error: error.message });
    }
};
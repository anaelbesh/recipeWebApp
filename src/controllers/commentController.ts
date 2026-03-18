import { Response } from "express";
import { Comment } from "../models/Comment";
import { Recipe } from "../models/Recipe";
import { AuthRequest } from "./common";

export const addComment = async (req: AuthRequest, res: Response) => {
    try {
        const { recipeId } = req.params;
        const { content } = req.body;

        // userId comes from the verified JWT token
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({ message: "Comment content is required" });
        }

        const recipeExists = await Recipe.exists({ _id: recipeId as string });
        if (!recipeExists) {
            return res.status(404).json({ message: "Recipe not found" });
        }

        const newComment = await Comment.create({
            user: userId,
            recipe: recipeId as string,
            content: content.trim(),
        });

        await newComment.populate('user', 'username profilePicture');

        res.status(201).json(newComment);
    } catch (error: any) {
        res.status(500).json({ message: "Error adding comment", error: error.message });
    }
};

export const getComments = async (req: AuthRequest, res: Response) => {
    try {
        const { recipeId } = req.params;

        const comments = await Comment.find({ recipe: recipeId as string })
            .sort({ createdAt: -1 })
            .populate('user', 'username profilePicture')
            .lean();

        res.status(200).json(comments);
    } catch (error: any) {
        res.status(500).json({ message: "Error fetching comments", error: error.message });
    }
};

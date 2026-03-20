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

export const updateComment = async (req: AuthRequest, res: Response) => {
    try {
        const { commentId } = req.params;
        const { content } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({ message: "Comment content is required" });
        }

        const comment = await Comment.findById(commentId);

        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        if (comment.user.toString() !== userId) {
            return res.status(403).json({ message: "You are not authorized to edit this comment" });
        }

        comment.content = content.trim();
        await comment.save();

        await comment.populate('user', 'username profilePicture');

        res.status(200).json(comment);
    } catch (error: any) {
        res.status(500).json({ message: "Error updating comment", error: error.message });
    }
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
    try {
        const { commentId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const comment = await Comment.findById(commentId);

        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        if (comment.user.toString() !== userId) {
            return res.status(403).json({ message: "You are not authorized to delete this comment" });
        }

        await Comment.findByIdAndDelete(commentId);

        res.status(200).json({ message: "Comment deleted successfully" });
    } catch (error: any) {
        res.status(500).json({ message: "Error deleting comment", error: error.message });
    }
};

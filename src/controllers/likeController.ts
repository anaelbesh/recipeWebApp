import { Response } from "express";
import { Like } from "../models/Like";
import { AuthRequest } from "./common";

const likeController = {
    toggle: async (req: AuthRequest, res: Response) => {
        try {
            const { recipeId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ message: "Authentication required" });
            }

            const existingLike = await Like.findOne({ user: userId, recipe: recipeId as string });

            if (existingLike) {
                await Like.findByIdAndDelete(existingLike._id);
                return res.status(200).json({ message: "Unliked", liked: false });
            }

            const newLike = await Like.create({ user: userId, recipe: recipeId as string });
            res.status(201).json({ message: "Liked", liked: true, data: newLike });
        } catch (error: any) {
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
};

export default likeController;

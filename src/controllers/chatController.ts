import { Request, Response } from "express";
import ChatMessage from "../models/ChatMessage";

// User settings, similar to how it is saved on JWT
interface AuthRequest extends Request {
    user?: {
        _id: string;
        email: string
    };
}

export const getChatHistory = async (req: AuthRequest, res: Response) => {
    try {
        const { partnerId } = req.params;

        // Dor's comment: we need to have this and use JWT:
        // const userId = req.user?._id;
        //
        // For testing purposes, i will support sending the user id from the URL
        // Remove this after we have JWT!
        const userId = req.user?._id || req.query.userId;

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const messages = await ChatMessage.find({
            $or: [
                { senderId: userId, receiverId: partnerId },
                { senderId: partnerId, receiverId: userId }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: "Error fetching history" });
    }
};
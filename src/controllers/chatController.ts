import { Response } from "express";
import ChatMessage from "../models/ChatMessage";
import { AuthRequest } from "./common";


export const getChatHistory = async (req: AuthRequest, res: Response) => {
    try {
        const { partnerId } = req.params;

        // Dor's comment: we need to have this and use JWT:
        // const userId = req.user?._id;
        //
        // For testing purposes, I will support sending the user id from the URL
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
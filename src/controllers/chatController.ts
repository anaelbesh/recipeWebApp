import { Response } from "express";
import ChatMessage from "../models/ChatMessage";
import { AuthRequest } from "./common";


export const getChatHistory = async (req: AuthRequest, res: Response) => {
    try {
        const { partnerId } = req.params;
        const userId = req.user?.id;

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
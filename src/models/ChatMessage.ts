import mongoose, { Schema, Document } from "mongoose";

export interface IChatMessage extends Document {
    senderId: string;
    receiverId: string;
    message: string;
    createdAt: Date;
}

const ChatMessageSchema = new Schema({
    senderId: String,
    receiverId: String,
    message: String,
    isRead: { type: Boolean, default: false }, // שדה חובה להיסטוריה
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
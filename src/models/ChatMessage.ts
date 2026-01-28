import mongoose, { Schema, Document } from "mongoose";

export interface IChatMessage extends Document {
    senderId: string;
    receiverId: string;
    message: string;
    createdAt: Date;
}

const ChatMessageSchema: Schema = new Schema({
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
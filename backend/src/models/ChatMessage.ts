import { Schema, model} from "mongoose";

const ChatMessageSchema = new Schema({
    senderId: String,
    receiverId: String,
    message: String,
    isRead: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

export default model("ChatMessage", ChatMessageSchema);
import { Server } from "socket.io";
import ChatMessage from "../models/ChatMessage";

export const initSocket = (server: any) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.NODE_ENV === "production"
                ?  process.env.SERVER_ADDRESS: "*", // Test - all open, prod - closed to our SERVER_ADDRESS
            methods: ["GET", "POST"]
        },
    });

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        // Join a private room based on User ID
        socket.on("join", (userId: string) => {
            socket.join(userId);
            console.log(`User ${userId} joined their private room`);
        });

        // Handle sending messages
        socket.on("send_message", async (data: {
            // Temp id is being used to generate id and show the message immediately to the user, when this
            // message is saved to db, we will use the permanent id we got from the record ID
            tempId: string;

            senderId: string;
            receiverId: string;
            message: string
        }) => {

            console.log(`📩 New message from ${data.senderId} to ${data.receiverId}: ${data.message}`);

            try {
                // Save message to MongoDB for persistence
                const newMessage = new ChatMessage({
                    senderId: data.senderId,
                    receiverId: data.receiverId,
                    message: data.message
                });

                const savedMessage = await newMessage.save();
                console.log(`✅ Message saved to DB with ID: ${savedMessage._id}`);

                // 1. Emit the message to the receiver in real-time
                io.to(data.receiverId).emit("receive_message", savedMessage);

                // 2. Send acknowledgment back to the sender for the "V" icon
                socket.emit("message_received_ack", {
                    tempId: data.tempId,          // Original ID from client
                    permanentId: savedMessage._id, // MongoDB generated ID
                    status: "delivered"
                });

            } catch (err) {
                console.error("❌ Error saving message:", err);
                socket.emit("message_error", {
                    tempId: data.tempId,
                    error: "Failed to persist message"
                });
            }
        });

        socket.on("mark_as_read", async (data: { messageId: string, senderId: string }) => {
            try {
                // 1. Update the database (Assumes your ChatMessage model has an 'isRead' field)
                await ChatMessage.findByIdAndUpdate(data.messageId, { isRead: true });

                console.log(`👁️ Message ${data.messageId} marked as read`);

                // 2. Notify the ORIGINAL sender that their message was read
                io.to(data.senderId).emit("message_read_update", {
                    messageId: data.messageId
                });
            } catch (err) {
                console.error("❌ Error marking message as read:", err);
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected");
        });
    });

    return io;
};
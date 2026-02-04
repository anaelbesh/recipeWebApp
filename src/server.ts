import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { connectMongo } from "./db";
import { initSocket } from "./sockets/socket";
import { getChatHistory } from "./controllers/chatController";

const app = express();
const allowedOrigins = [
    process.env.SERVER_ADDRESS,
    "http://localhost:63343" // Testing locally
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
const server = http.createServer(app); // Create a server that wraps express HTTPS

app.use(express.json());

initSocket(server);

app.get("/api/chat/history/:partnerId", getChatHistory);

async function start() {
  await connectMongo();

  const port = Number(process.env.PORT || 4000);

  server.listen(port, () => {
    console.log(`✅ Service is listening on port ${port}`);
    console.log(`🚀 Socket.io is ready at http://node03.cs.colman.ac.il:${port}/socket.io/`);
  });
}

start().then(r => {});
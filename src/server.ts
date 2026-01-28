import "dotenv/config";
import express from "express";
import http from "http";
import { connectMongo } from "./db";
import { initSocket } from "./sockets/socket";
import { getChatHistory } from "./controllers/chatController";

const app = express();
const server = http.createServer(app); // Create a server that wraps express HTTPS

app.use(express.json());

initSocket(server);

app.get("/api/chat/history/:partnerId", getChatHistory);

async function start() {
  await connectMongo();

  const port = Number(process.env.PORT || 4000);

  // 5. חשוב מאוד: תקשיב ל-server ולא ל-app!
  server.listen(port, () => {
    console.log(`✅ Service is listening on port ${port}`);
    console.log(`🚀 Socket.io is ready at http://node03.cs.colman.ac.il:${port}/socket.io/`);
  });
}

start();
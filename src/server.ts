import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { connectMongo } from "./db";
import { initSocket } from "./sockets/socket";
import { getChatHistory } from "./controllers/chatController";
import recipeRoutes from "./routes/recipeRoutes";

export const app = express();

function prerequisites(){
    const allowedOrigins = [
        process.env.SERVER_ADDRESS,
        "http://localhost:4000"   // Local server
    ];

    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"]
    }));

    // Serve static files from public directory
    const publicPath = path.join(__dirname, "..", "public");
    app.use(express.static(publicPath));

    // Serve React app static files from client/dist
    const clientDistPath = path.join(__dirname, "..", "client", "dist");
    app.use("/chat", express.static(clientDistPath));
}

function initializeRoutes(app: express.Application) {
    app.get("/api/chat/history/:partnerId", getChatHistory);

    app.use("/api/recipes", recipeRoutes);

    // Serve React chat app at /chat
    app.get("/chat", (req, res) => {
        const clientDistPath = path.join(__dirname, "..", "client", "dist");
        res.sendFile(path.join(clientDistPath, "index.html"));
    });
}

async function runServer(){
    prerequisites();
    const server = http.createServer(app); // Create a server that wraps express HTTPS
    app.use(express.json());
    initSocket(server);
    initializeRoutes(app);
    await connectMongo();

    const port = Number(process.env.PORT || 4000);

    if (process.env.NODE_ENV !== 'test') {
        server.listen(port, () => {
            console.log(`Service is listening on port ${port}`);
            console.log(`Socket.io is ready at http://node03.cs.colman.ac.il:${port}/socket.io/`);
        });
    }

}


async function start() {
    await runServer();
}

start().then(r => {});
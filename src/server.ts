import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { connectMongo } from "./db";
import { initSocket } from "./sockets/socket";
import { getChatHistory } from "./controllers/chatController";
import { verifyToken } from "./middleware/authMiddleware";
import recipeRoutes from "./routes/recipeRoutes";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import { setupSwagger } from "./config/swagger";

export const app = express();

function prerequisites() {
    const allowedOrigins = [
        process.env.SERVER_ADDRESS,
        process.env.CLIENT_ORIGIN || "http://localhost:5173",
        "http://localhost:4000",  // Local server
    ].filter(Boolean) as string[];

    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"]
    }));

    // Serve static files from public directory
    const publicPath = path.join(__dirname, "..", "public");
    app.use(express.static(publicPath));

    // Serve React app static files from client/dist at root
    const clientDistPath = path.join(__dirname, "..", "client", "dist");
    app.use(express.static(clientDistPath));

    // Serve uploaded files (avatars, recipe images, etc.)
    app.use("/uploads", express.static(path.resolve("data", "uploads")));
}

function initializeRoutes(app: express.Application) {
    app.get("/api/chat/history/:partnerId", verifyToken, getChatHistory);

    app.use("/api/recipes", recipeRoutes);
    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);

    // serve index.html for all non-API routes (/login, /chat, /profile, etc.)
    app.use((req, res) => {
        const clientDistPath = path.join(__dirname, "..", "client", "dist");
        res.sendFile(path.join(clientDistPath, "index.html"));
    });
}

async function runServer() {
    prerequisites();
    const server = http.createServer(app);
    app.use(express.json());
    initSocket(server);
    initializeRoutes(app);

    // Swagger docs
    setupSwagger(app);

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

start().then(() => {});

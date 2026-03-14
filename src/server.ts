// dotenv is pre-loaded via ts-node-dev --require dotenv/config (see package.json).
// This means process.env is fully populated before any module-level code runs.
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
import aiRoutes from "./routes/aiRoutes";
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
    app.use("/api/ai", aiRoutes);

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
        // Retry listener — ts-node-dev on Windows force-kills the old process,
        // so the OS may not have released the port yet when we restart.
        const startListening = (attemptsLeft: number) => {
            server.removeAllListeners('error');
            server.listen(port, () => {
                console.log(`Service is listening on port ${port}`);
                console.log(`Socket.io is ready at http://node03.cs.colman.ac.il:${port}/socket.io/`);
                console.log(`[startup] GEMINI_API_KEY loaded: ${!!process.env.GEMINI_API_KEY}`);
            });
            server.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
                    console.warn(`[server] Port ${port} busy — retrying in 2 s (${attemptsLeft} left)…`);
                    server.close();
                    setTimeout(() => startListening(attemptsLeft - 1), 2000);
                } else {
                    console.error('[server] Fatal listen error:', err.message);
                    process.exit(1);
                }
            });
        };
        startListening(5);

        const shutdown = () => {
            server.close(() => process.exit(0));
            setTimeout(() => process.exit(0), 1500).unref();
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT',  shutdown);
    }
}

async function start() {
    await runServer();
}

// Only start the HTTP server when this file is the entry point (ts-node-dev / node dist/server.js).
// When imported by tests, supertest uses the app directly — no port needed.
if (require.main === module) {
    start().then(() => {});
} else {
    // Imported by tests: set up routes/middleware/DB (but don't bind a port).
    runServer().catch((err) => console.error('[server] init error:', err));
}

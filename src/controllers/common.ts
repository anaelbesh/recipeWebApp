import { Request } from "express";

// User shape matches what authMiddleware sets on req.user after verifyToken
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email?: string;
    };
}


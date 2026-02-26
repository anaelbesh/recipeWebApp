import { Request } from "express";

// User settings, similar to how it is saved on JWT
export interface AuthRequest extends Request {
    user?: {
        _id: string;
        email: string
    };
}


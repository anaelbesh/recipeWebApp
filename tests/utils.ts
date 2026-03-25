import request from "supertest";
import { Express } from "express";

export type UserData = {
    email: string;
    username: string;
    password: string;
    _id: string;
    accessToken: string;
    refreshToken: string;
};

export const userData: UserData = {
    email: "test@test.com",
    username: "testuser",
    password: "TestPass123!",
    _id: "",
    accessToken: "",
    refreshToken: ""
};

export const getLoggedInUser = async (app: Express): Promise<UserData> => {
    const { email, username, password } = userData;
    let response = await request(app).post("/api/auth/register").send(
        { email, username, password }
    );
    if (response.status !== 201) {
        response = await request(app).post("/api/auth/login").send(
            { email, password });
    }
    const loggedUser: UserData = {
        _id: response.body.user?.id || "",
        accessToken: response.body.accessToken,
        refreshToken: response.body.refreshToken,
        email,
        username,
        password
    };
    return loggedUser;
};

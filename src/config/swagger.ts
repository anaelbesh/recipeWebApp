import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const swaggerDefinition: swaggerJSDoc.OAS3Definition = {
  openapi: "3.0.0",
  info: {
    title: "Recipe WebApp API",
    version: "1.0.0",
    description:
      "REST API for the Recipe WebApp – authentication (JWT + refresh-token rotation), recipe comments & likes, and chat history.",
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local development server",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "JWT access token obtained from /api/auth/login or /api/auth/register",
      },
    },
    schemas: {
      // ── Auth ──────────────────────────────────────────────
      UserResponse: {
        type: "object",
        properties: {
          id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
          username: { type: "string", example: "johndoe" },
          email: { type: "string", example: "john@example.com" },
          provider: {
            type: "string",
            enum: ["local", "google", "facebook"],
            example: "local",
          },
          profilePicture: {
            type: "string",
            nullable: true,
            example: "https://lh3.googleusercontent.com/a/photo.jpg",
          },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "User registered successfully" },
          user: { $ref: "#/components/schemas/UserResponse" },
          accessToken: {
            type: "string",
            description: "JWT access token (short-lived)",
            example: "eyJhbGciOiJIUzI1NiIs...",
          },
          refreshToken: {
            type: "string",
            description: "JWT refresh token (long-lived)",
            example: "eyJhbGciOiJIUzI1NiIs...",
          },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["username", "email", "password"],
        properties: {
          username: {
            type: "string",
            minLength: 3,
            maxLength: 30,
            example: "johndoe",
          },
          email: {
            type: "string",
            format: "email",
            example: "john@example.com",
          },
          password: {
            type: "string",
            minLength: 6,
            example: "securePassword123",
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "john@example.com",
          },
          password: {
            type: "string",
            example: "securePassword123",
          },
        },
      },
      RefreshRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: {
            type: "string",
            description: "The JWT refresh token received from login/register",
            example: "eyJhbGciOiJIUzI1NiIs...",
          },
        },
      },
      RefreshResponse: {
        type: "object",
        properties: {
          accessToken: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIs...",
          },
          refreshToken: {
            type: "string",
            description: "New rotated JWT refresh token",
            example: "eyJhbGciOiJIUzI1NiIs...",
          },
        },
      },
      LogoutRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: {
            type: "string",
            description: "The JWT refresh token to revoke",
            example: "eyJhbGciOiJIUzI1NiIs...",
          },
        },
      },
      // ── Recipes (Comments & Likes) ───────────────────────
      Comment: {
        type: "object",
        properties: {
          _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
          user: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
          recipe: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0e" },
          content: { type: "string", example: "Delicious recipe!" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AddCommentRequest: {
        type: "object",
        required: ["content"],
        properties: {
          userId: {
            type: "string",
            description: "User ID (temporary – will be replaced by JWT)",
            example: "665f1a2b3c4d5e6f7a8b9c0d",
          },
          content: {
            type: "string",
            example: "Great recipe, loved it!",
          },
        },
      },
      LikeToggleRequest: {
        type: "object",
        required: ["userId"],
        properties: {
          userId: {
            type: "string",
            description: "User ID toggling the like",
            example: "665f1a2b3c4d5e6f7a8b9c0d",
          },
        },
      },
      LikeToggleResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Liked" },
          liked: { type: "boolean", example: true },
          data: {
            type: "object",
            nullable: true,
            properties: {
              _id: { type: "string" },
              user: { type: "string" },
              recipe: { type: "string" },
            },
          },
        },
      },
      // ── Chat ─────────────────────────────────────────────
      ChatMessage: {
        type: "object",
        properties: {
          _id: { type: "string" },
          senderId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
          receiverId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0e" },
          message: { type: "string", example: "Hey, how are you?" },
          isRead: { type: "boolean", example: false },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      // ── Generic ──────────────────────────────────────────
      MessageResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
    },
  },
  paths: {
    // ═══════════════════════  AUTH  ═══════════════════════
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        description:
          "Creates a new user account. Returns access token and refresh token.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "User registered successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          "400": {
            description: "Missing fields or user already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        description:
          "Authenticates user with email + password. Returns access token and refresh token.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          "400": {
            description: "Email and password are required, or account uses an OAuth provider",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        description:
          "Send the refresh token in the request body. The old refresh token is invalidated (one-time use) and a new access + refresh token pair is returned (rotation).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "New access and refresh tokens issued",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshResponse" },
              },
            },
          },
          "401": {
            description: "Refresh token required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Invalid or expired refresh token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout and revoke refresh token",
        description:
          "Deletes the refresh token from the DB, immediately invalidating it.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LogoutRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Logout successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          "400": {
            description: "Refresh token required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    // ═══════════════════  OAUTH  ═════════════════════════
    "/api/auth/google": {
      get: {
        tags: ["OAuth"],
        summary: "Redirect to Google sign-in",
        description:
          "Redirects the user to Google's OAuth 2.0 consent screen. After approval, Google redirects back to /api/auth/google/callback.",
        responses: {
          "302": {
            description: "Redirect to Google consent screen",
          },
        },
      },
    },
    "/api/auth/google/callback": {
      get: {
        tags: ["OAuth"],
        summary: "Google OAuth callback",
        description:
          "Handles the redirect from Google after the user approves or denies access. On success, issues JWT tokens and redirects to the client app with tokens in query params.",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Authorization code from Google",
          },
          {
            name: "state",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "CSRF state token",
          },
        ],
        responses: {
          "302": {
            description:
              "Redirect to CLIENT_ORIGIN/auth/callback?accessToken=...&refreshToken=...",
          },
          "400": {
            description: "Missing state or authorization code",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Google authentication failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/facebook": {
      get: {
        tags: ["OAuth"],
        summary: "Redirect to Facebook sign-in",
        description:
          "Redirects the user to Facebook's OAuth dialog. After approval, Facebook redirects back to /api/auth/facebook/callback.",
        responses: {
          "302": {
            description: "Redirect to Facebook login dialog",
          },
        },
      },
    },
    "/api/auth/facebook/callback": {
      get: {
        tags: ["OAuth"],
        summary: "Facebook OAuth callback",
        description:
          "Handles the redirect from Facebook after the user approves or denies access. On success, issues JWT tokens and redirects to the client app with tokens in query params.",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Authorization code from Facebook",
          },
          {
            name: "state",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "CSRF state token",
          },
        ],
        responses: {
          "302": {
            description:
              "Redirect to CLIENT_ORIGIN/auth/callback?accessToken=...&refreshToken=...",
          },
          "400": {
            description: "Missing state or authorization code",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Facebook authentication failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    // ═══════════════════  RECIPES  ════════════════════════
    "/api/recipes/{recipeId}/comments": {
      post: {
        tags: ["Recipes"],
        summary: "Add a comment to a recipe",
        parameters: [
          {
            name: "recipeId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The recipe's MongoDB ObjectId",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AddCommentRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Comment created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Comment" },
              },
            },
          },
          "400": {
            description: "Comment content is required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/recipes/{recipeId}/likes": {
      post: {
        tags: ["Recipes"],
        summary: "Toggle like on a recipe",
        description:
          "If the user has not liked the recipe, a like is created. If the user already liked it, the like is removed.",
        parameters: [
          {
            name: "recipeId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The recipe's MongoDB ObjectId",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LikeToggleRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Unliked (like removed)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LikeToggleResponse" },
              },
            },
          },
          "201": {
            description: "Liked (like created)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LikeToggleResponse" },
              },
            },
          },
        },
      },
    },
    // ═══════════════════  CHAT  ═══════════════════════════
    "/api/chat/history/{partnerId}": {
      get: {
        tags: ["Chat"],
        summary: "Get chat history with a partner",
        description:
          "Returns all messages between the authenticated user and the specified partner, sorted by creation date.",
        parameters: [
          {
            name: "partnerId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The partner user's MongoDB ObjectId",
          },
          {
            name: "userId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "User ID (temporary query param – will be replaced by JWT)",
          },
        ],
        responses: {
          "200": {
            description: "Array of chat messages",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ChatMessage" },
                },
              },
            },
          },
          "401": {
            description: "User not authenticated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [],
});

export function setupSwagger(app: Express): void {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Serve raw JSON spec
  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.log("Swagger docs available at /api-docs");
}

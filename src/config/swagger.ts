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
          "JWT access token obtained from /api/auth/login, /api/auth/register, or OAuth callback. Payload contains { id, username, email }.",
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
            maxLength: 50,
            pattern: "^[a-zA-Z0-9_-]+$",
            description: "Alphanumeric, hyphens, and underscores only",
            example: "johndoe",
          },
          email: {
            type: "string",
            format: "email",
            example: "john@example.com",
          },
          password: {
            type: "string",
            minLength: 8,
            description: "Must contain uppercase, lowercase, digit, and special char (!@#$%^&*)",
            example: "SecurePass123!",
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
      // ── Recipes ──────────────────────────────────────────
      Recipe: {
        type: "object",
        properties: {
          _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
          title: { type: "string", example: "Classic Pancakes" },
          instructions: { type: "string", example: "Mix flour, eggs and milk. Fry on medium heat." },
          ingredients: {
            type: "array",
            items: { type: "string" },
            example: ["flour", "eggs", "milk"],
          },
          imageUrl: {
            type: "string",
            nullable: true,
            example: "https://example.com/pancakes.jpg",
          },
          category: { type: "string", example: "Breakfast" },
          kosherType: { type: "string", enum: ["Meat", "Dairy", "Parve"], example: "Parve" },
          cookingMethod: { type: "string", enum: ["Grill", "Oven", "Pan", "NoCook", "Boil", "Fry"], example: "Pan" },
          dishType: { type: "string", enum: ["Main", "Side", "Dessert", "Snack", "Spread"], example: "Main" },
          createdBy: {
            type: "object",
            properties: {
              _id: { type: "string" },
              username: { type: "string" },
              profilePicture: { type: "string", nullable: true },
            },
          },
          commentCount: { type: "integer", example: 3 },
          likeCount: { type: "integer", example: 12 },
          likedByMe: { type: "boolean", example: false },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      RecipeCreateRequest: {
        type: "object",
        required: ["title", "instructions", "category"],
        properties: {
          title: { type: "string", minLength: 3, maxLength: 120, example: "Classic Pancakes" },
          instructions: { type: "string", minLength: 10, maxLength: 20000, example: "Mix flour, eggs and milk. Fry on medium heat until golden." },
          ingredients: {
            type: "array",
            items: { type: "string" },
            example: ["flour", "eggs", "milk"],
          },
          imageUrl: { type: "string", example: "https://example.com/pancakes.jpg" },
          category: { $ref: "#/components/schemas/RecipeCategory" },
          kosherType: { type: "string", enum: ["Meat", "Dairy", "Parve"], example: "Parve" },
          cookingMethod: { type: "string", enum: ["Grill", "Oven", "Pan", "NoCook", "Boil", "Fry"], example: "Pan" },
          dishType: { type: "string", enum: ["Main", "Side", "Dessert", "Snack", "Spread"], example: "Main" },
        },
      },
      RecipeUpdateRequest: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 3, maxLength: 120, example: "Updated Pancakes" },
          instructions: { type: "string", minLength: 10, maxLength: 20000, example: "Updated instructions here." },
          ingredients: {
            type: "array",
            items: { type: "string" },
            example: ["flour", "eggs", "milk", "butter"],
          },
          imageUrl: { type: "string", example: "https://example.com/new-image.jpg" },
          category: { $ref: "#/components/schemas/RecipeCategory" },
          kosherType: { type: "string", enum: ["Meat", "Dairy", "Parve"], example: "Parve" },
          cookingMethod: { type: "string", enum: ["Grill", "Oven", "Pan", "NoCook", "Boil", "Fry"], example: "Pan" },
          dishType: { type: "string", enum: ["Main", "Side", "Dessert", "Snack", "Spread"], example: "Main" },
        },
      },
      RecipeListResponse: {
        type: "object",
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/Recipe" } },
          page:  { type: "integer", example: 1 },
          limit: { type: "integer", example: 10 },
          total: { type: "integer", example: 42 },
          pages: { type: "integer", example: 5 },
        },
      },
      // ── Recipes (Comments & Likes) ───────────────────────
      Comment: {
        type: "object",
        properties: {
          _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
          user: {
            type: "object",
            properties: {
              _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
              username: { type: "string", example: "johndoe" },
              profilePicture: { type: "string", nullable: true },
            },
          },
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
          content: {
            type: "string",
            example: "Great recipe, loved it!",
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
      UpdateCommentRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", minLength: 1, example: "Updated comment here" },
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
      // ── Uploads ────────────────────────────────────────────
      UploadResponse: {
        type: "object",
        properties: {
          imageUrl: { type: "string", example: "/uploads/recipe-images/abc123def456.webp" },
        },
      },
      // ── AI (RAG & Search) ──────────────────────────────────
      AISearchParseRequest: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", example: "recipes with garlic and olive oil" },
          locale: { type: "string", enum: ["en-US", "he-IL"], example: "en-US" },
          maxResults: { type: "integer", minimum: 1, maximum: 50, example: 10 },
        },
      },
      AISearchParseResponse: {
        type: "object",
        properties: {
          requestId: { type: "string", example: "req_m9x8k2ab" },
          normalizedQuery: { type: "string", example: "garlic olive oil" },
          filters: { type: "object", additionalProperties: true },
          warnings: { type: "array", items: { type: "string" }, example: [] },
          confidence: { type: "number", example: 0.93 },
        },
      },
      AIChatHistoryMessage: {
        type: "object",
        required: ["role", "content"],
        properties: {
          role: { type: "string", enum: ["user", "assistant"], example: "user" },
          content: { type: "string", example: "What can I cook with lentils?" },
        },
      },
      AIRagSource: {
        type: "object",
        properties: {
          recipeId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
          title: { type: "string", example: "Lentil Soup" },
          category: { type: "string", example: "Parve" },
          imageUrl: { type: "string", nullable: true, example: "https://example.com/lentil.jpg" },
          snippet: { type: "string", example: "...cook lentils with onion, carrots and celery..." },
          score: { type: "number", nullable: true, example: 0.91 },
          reason: { type: "string", nullable: true, example: "High semantic similarity" },
        },
      },
      AIChatRequest: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string", example: "How do I make a vegan pasta?" },
          locale: { type: "string", enum: ["en-US", "he-IL"], example: "en-US" },
          category: { type: "string", example: "Parve" },
          history: {
            type: "array",
            items: { $ref: "#/components/schemas/AIChatHistoryMessage" },
          },
        },
      },
      AIChatResponse: {
        type: "object",
        properties: {
          requestId: { type: "string", example: "req_m9x8k2ab" },
          answer: { type: "string", example: "To make a vegan pasta, use plant-based cream or oil-based sauces..." },
          sources: {
            type: "array",
            items: { $ref: "#/components/schemas/AIRagSource" },
          },
          secondarySources: {
            type: "array",
            items: { $ref: "#/components/schemas/AIRagSource" },
          },
          followUpQuestion: { type: "string", nullable: true, example: "Do you prefer quick or slow-cooked dishes?" },
          fallback: { type: "string", nullable: true, example: "keyword" },
        },
      },
      AIModelsResponse: {
        type: "object",
        properties: {
          models: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", example: "models/gemini-1.5-pro" },
                displayName: { type: "string", example: "Gemini 1.5 Pro" },
              },
            },
          },
        },
      },
      BackfillEmbeddingsResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "All recipes already have embeddings." },
          updated: { type: "integer", example: 0 },
        },
      },
      RecipeCategory: {
        type: "string",
        enum: [
          "Meat",
          "Dairy",
          "Parve",
          "Desserts",
          "Pastries / Baked Goods",
          "Bread",
          "Salads",
          "Asian",
          "Sandwiches / Wraps",
          "Comfort Food",
          "Healthy / Light",
          "Sauces & Spreads",
          "Breakfast",
          "Gluten-Free",
          "Other",
        ],
        example: "Breakfast",
      },
      UserListItem: {
        type: "object",
        properties: {
          _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
          name: { type: "string", example: "johndoe" },
          email: { type: "string", example: "john@example.com" },
          profilePicture: { type: "string", nullable: true, example: "https://lh3.googleusercontent.com/a/photo.jpg" },
        },
      },
      UserDocumentResponse: {
        type: "object",
        properties: {
          _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
          username: { type: "string", example: "johndoe" },
          email: { type: "string", example: "john@example.com" },
          provider: { type: "string", enum: ["local", "google", "facebook"], example: "local" },
          profilePicture: { type: "string", nullable: true, example: "https://lh3.googleusercontent.com/a/photo.jpg" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CategoriesResponse: {
        type: "object",
        properties: {
          categories: { type: "array", items: { $ref: "#/components/schemas/RecipeCategory" } },
        },
      },
      ValidationErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Validation failed" },
          errors: {
            type: "object",
            example: {
              email: "Please enter a valid email address (e.g., user@example.com)",
              password: ["At least 8 characters", "At least 1 uppercase letter (A-Z)"],
            },
          },
        },
      },
      // ── Generic ────────────────────────────────────────────
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
          error: { type: "string" },
          reason: { type: "string" },
          hint: { type: "string" },
          errors: { type: "object", additionalProperties: true },
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
          "Creates a new user account. Password must meet strength policy: 8+ characters, uppercase, lowercase, number, special char. Returns access token and refresh token.",
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
            description: "Validation failed – missing fields, invalid email, weak password, or user already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationErrorResponse" },
                example: {
                  message: "Validation failed",
                  errors: {
                    email: "Please enter a valid email address (e.g., user@example.com)",
                    password: ["At least 8 characters", "At least 1 special character (!@#$%^&*)"],
                    username: "Username must be at least 3 characters",
                  },
                },
              },
            },
          },
          "409": {
            description: "Email or username already in use",
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
            description: "Validation failed – invalid email format or missing fields",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationErrorResponse" },
              },
            },
          },
          "401": {
            description: "Invalid credentials (generic message to prevent user enumeration)",
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
          "404": {
            description: "User not found",
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
              "Redirect to CLIENT_ORIGIN/auth/callback?accessToken=...&refreshToken=...&userId=...&username=...&email=...&profilePicture=... (profilePicture omitted if not set)",
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
              "Redirect to CLIENT_ORIGIN/auth/callback?accessToken=...&refreshToken=...&userId=...&username=...&email=...&profilePicture=... (profilePicture omitted if not set)",
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
    "/api/recipes": {
      get: {
        tags: ["Recipes"],
        summary: "List recipes",
        description: "Returns a paginated list of recipes. Supports full-text search via `search` param (matches title, instructions, ingredients). Pass `mine=true` with a Bearer token to get only your own recipes.",
        security: [],
        parameters: [
          { name: "search", in: "query", required: false, schema: { type: "string" }, description: "Full-text search across title, instructions and ingredients" },
          { name: "q", in: "query", required: false, schema: { type: "string" }, description: "Alias of search" },
          { name: "page",   in: "query", required: false, schema: { type: "integer", default: 1 }, description: "Page number (1-based)" },
          { name: "limit",  in: "query", required: false, schema: { type: "integer", default: 10, maximum: 50 }, description: "Results per page (max 50)" },
          { name: "sort",   in: "query", required: false, schema: { type: "string", default: "-createdAt" }, description: "Sort field, prefix with - for descending (e.g. -createdAt, title)" },
          { name: "category", in: "query", required: false, schema: { $ref: "#/components/schemas/RecipeCategory" }, description: "Filter by recipe category" },
          { name: "cursor", in: "query", required: false, schema: { type: "string" }, description: "Cursor token for cursor-based pagination" },
          { name: "mine",   in: "query", required: false, schema: { type: "boolean" }, description: "If true, return only the authenticated user's recipes (requires Bearer token)" },
        ],
        responses: {
          "200": {
            description: "Paginated recipe list",
            content: { "application/json": { schema: { $ref: "#/components/schemas/RecipeListResponse" } } },
          },
          "401": { description: "mine=true requires authentication", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "500": { description: "Internal server error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      post: {
        tags: ["Recipes"],
        summary: "Create a recipe",
        description: "Creates a new recipe owned by the authenticated user.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RecipeCreateRequest" } } },
        },
        responses: {
          "201": {
            description: "Recipe created",
            content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, recipe: { $ref: "#/components/schemas/Recipe" } } } } },
          },
          "400": { description: "Validation error – missing or invalid fields", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "500": { description: "Internal server error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/recipes/categories": {
      get: {
        tags: ["Recipes"],
        summary: "Get recipe categories",
        description: "Returns the list of all allowed recipe categories (static list).",
        security: [],
        responses: {
          "200": {
            description: "List of categories",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CategoriesResponse" },
              },
            },
          },
        },
      },
    },
    "/api/recipes/ai-search": {
      get: {
        tags: ["Recipes", "AI"],
        summary: "Semantic search recipes via AI embeddings",
        description: "Performs semantic/vector search using Gemini embeddings. Pass a natural language query and get recipes ranked by relevance.",
        security: [],
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Natural language search query (e.g., 'quick pasta recipes')",
          },
          {
            name: "category",
            in: "query",
            required: false,
            schema: { $ref: "#/components/schemas/RecipeCategory" },
            description: "Optional category filter",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 10, maximum: 50 },
            description: "Max results (default 10)",
          },
        ],
        responses: {
          "200": {
            description: "Search results ranked by relevance",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/Recipe",
                      },
                    },
                    returned: { type: "integer", example: 10 },
                    aiUsed: { type: "boolean", example: true },
                    totalCandidates: { type: "integer", example: 132 },
                    fallback: { type: "string", nullable: true, example: "textSearch" },
                    message: { type: "string", nullable: true },
                    hint: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          "400": { description: "q parameter is required (minimum 2 characters)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "429": { description: "Rate limited", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/recipes/{id}": {
      get: {
        tags: ["Recipes"],
        summary: "Get recipe by ID",
        description: "Returns a single recipe with creator info populated.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "MongoDB ObjectId of the recipe" }],
        responses: {
          "200": {
            description: "Recipe found",
            content: { "application/json": { schema: { type: "object", properties: { recipe: { $ref: "#/components/schemas/Recipe" } } } } },
          },
          "400": { description: "Invalid ObjectId format", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "Recipe not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      put: {
        tags: ["Recipes"],
        summary: "Update a recipe",
        description: "Updates allowed fields (title, instructions, ingredients, imageUrl). Only the recipe owner can update.",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "MongoDB ObjectId of the recipe" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RecipeUpdateRequest" } } },
        },
        responses: {
          "200": {
            description: "Recipe updated",
            content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, recipe: { $ref: "#/components/schemas/Recipe" } } } } },
          },
          "400": { description: "Validation error or invalid ObjectId", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "403": { description: "Forbidden – not the recipe owner", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "Recipe not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      delete: {
        tags: ["Recipes"],
        summary: "Delete a recipe",
        description: "Permanently deletes a recipe. Only the recipe owner can delete.",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "MongoDB ObjectId of the recipe" }],
        responses: {
          "200": {
            description: "Recipe deleted",
            content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, deletedId: { type: "string" } } } } },
          },
          "400": { description: "Invalid ObjectId", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "403": { description: "Forbidden – not the recipe owner", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "Recipe not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/recipes/{recipeId}/comments": {
      get: {
        tags: ["Recipes"],
        summary: "Get comments for a recipe",
        security: [],
        parameters: [
          {
            name: "recipeId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The recipe's MongoDB ObjectId",
          },
        ],
        responses: {
          "200": {
            description: "Recipe comments (newest first)",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Comment" },
                },
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
      post: {
        tags: ["Recipes"],
        summary: "Add a comment to a recipe",
        security: [{ BearerAuth: [] }],
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
          "401": {
            description: "Unauthorized – missing or invalid token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Recipe not found",
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
    "/api/recipes/{recipeId}/likes": {
      post: {
        tags: ["Recipes"],
        summary: "Toggle like on a recipe",
        description:
          "If the user has not liked the recipe, a like is created. If the user already liked it, the like is removed.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "recipeId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The recipe's MongoDB ObjectId",
          },
        ],
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
          "401": {
            description: "Unauthorized – missing or invalid token",
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
    "/api/comments/{commentId}": {
      put: {
        tags: ["Comments"],
        summary: "Update a comment",
        description: "Updates the content of a comment. Only the comment author can update.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "commentId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "MongoDB ObjectId of the comment",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateCommentRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Comment updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Comment" },
              },
            },
          },
          "400": { description: "Content is required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "403": { description: "Forbidden – not the comment author", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "Comment not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "500": { description: "Internal server error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      delete: {
        tags: ["Comments"],
        summary: "Delete a comment",
        description: "Permanently deletes a comment. Only the comment author can delete.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "commentId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "MongoDB ObjectId of the comment",
          },
        ],
        responses: {
          "200": {
            description: "Comment deleted",
            content: {
              "application/json": {
                schema: { type: "object", properties: { message: { type: "string", example: "Comment deleted" } } },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "403": { description: "Forbidden – not the comment author", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "Comment not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "500": { description: "Internal server error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    // ═══════════════════  USERS  ══════════════════════════
    "/api/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get current user profile",
        description: "Returns the full profile of the authenticated user (from DB, not just JWT).",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Current user profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/UserDocumentResponse" } },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update current user profile",
        description: "Updates the authenticated user's username and/or avatar. Accepts multipart/form-data. Avatar is saved to disk; its URL is stored in the database.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string", example: "newUsername" },
                  avatar: { type: "string", format: "binary", description: "Image file (jpg/png/webp, max 5 MB)" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated user profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/UserDocumentResponse" } },
                },
              },
            },
          },
          "400": { description: "No fields to update or invalid file type", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "Get all users",
        description: "Returns a list of all registered users (passwords excluded).",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "List of users",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/UserListItem" },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get user by ID",
        description: "Returns a single user's public profile.",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "MongoDB ObjectId of the user" }],
        responses: {
          "200": {
            description: "User profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/UserDocumentResponse" } },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update user by ID (admin / self)",
        description: "Updates username, email, or password for the specified user.",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string", example: "newUsername" },
                  email: { type: "string", example: "new@example.com" },
                  password: { type: "string", example: "newPassword123" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/UserDocumentResponse" } },
                },
              },
            },
          },
          "400": { description: "No valid fields provided", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete user by ID",
        description: "Deletes the user and cascades: removes their comments and refresh tokens. Post cascade is added in Chunk 3.",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "User deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string", example: "User deleted successfully" } },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
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
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "partnerId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The partner user's MongoDB ObjectId",
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
    // ═══════════════════  UPLOADS  ════════════════════════
    "/api/uploads/recipe-image": {
      post: {
        tags: ["Uploads"],
        summary: "Upload recipe image",
        description: "Accepts a multipart/form-data file upload (jpg, png, webp). Returns the URL where the image is stored.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["image"],
                properties: {
                  image: {
                    type: "string",
                    format: "binary",
                    description: "Image file (jpg, png, webp; max 5 MB)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Image uploaded successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UploadResponse" },
              },
            },
          },
          "400": { description: "No file uploaded or invalid file type", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    // ═══════════════════  AI – MODELS  ═════════════════════
    "/api/ai/models": {
      get: {
        tags: ["AI"],
        summary: "List available AI models",
        description: "Returns the list of Gemini models available for the API key. Used for debugging/configuration.",
        security: [],
        responses: {
          "200": {
            description: "List of available models",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AIModelsResponse" },
              },
            },
          },
          "500": { description: "Failed to fetch models from Gemini API", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    // ═══════════════════  AI – SEARCH PARSE  ══════════════
    "/api/ai/search/parse": {
      post: {
        tags: ["AI"],
        summary: "Parse free-text query into structured search",
        description: "Uses AI to parse natural language into structured search terms (keywords, filters, etc.). Rate limited.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AISearchParseRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Parsed search structure",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AISearchParseResponse" },
              },
            },
          },
          "400": { description: "Query is required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "422": { description: "Low-confidence parse", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "429": { description: "Rate limited", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "503": { description: "AI service unavailable", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    // ═══════════════════  AI – RAG CHAT  ═══════════════════
    "/api/ai/chat": {
      post: {
        tags: ["AI"],
        summary: "RAG chat – ask questions about recipes",
        description: "Uses Retrieval-Augmented Generation (RAG) to answer questions grounded in your recipe database. Returns answer + source recipes.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AIChatRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "RAG response with answer and sources",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AIChatResponse" },
              },
            },
          },
          "400": { description: "Message is required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "429": { description: "Rate limited", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "503": { description: "Gemini API unavailable or rate limited", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    // ═══════════════════  AI – BACKFILL  ═══════════════════
    "/api/ai/backfill-embeddings": {
      post: {
        tags: ["AI"],
        summary: "Generate embeddings for recipes missing them",
        description: "Generates Gemini embeddings for all recipes that don't have them yet (supports semantic search). Requires authentication.",
        security: [{ BearerAuth: [] }],
        responses: {
          "202": {
            description: "Backfill accepted and started in background",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Backfill started for 12 recipe(s). Check server logs for progress." },
                    total: { type: "integer", example: 12 },
                  },
                },
              },
            },
          },
          "200": {
            description: "No missing embeddings to backfill",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BackfillEmbeddingsResponse" },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "500": { description: "Failed to generate embeddings", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
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

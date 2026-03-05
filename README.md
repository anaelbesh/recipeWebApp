# RecipeWebApp

A full-stack recipe social platform. Users can register/login (local or OAuth), manage their profile and avatar, post and comment on recipes, like posts, and chat with other users in real time.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [File Uploads](#file-uploads)
- [Real-Time Chat (Socket.io)](#real-time-chat-socketio)
- [OAuth (Google & Facebook)](#oauth-google--facebook)
- [Running Tests](#running-tests)
- [Deployment Notes](#deployment-notes)

---

## Architecture

```
recipeWebApp/
├── src/               # Express backend (TypeScript)
│   ├── config/        # JWT, OAuth, Swagger config
│   ├── controllers/   # Route handlers
│   ├── middleware/    # verifyToken, multer upload factory
│   ├── models/        # Mongoose schemas
│   ├── routes/        # Express routers
│   ├── services/      # OAuth token exchange logic
│   └── sockets/       # Socket.io event handlers
├── client/            # React 18 + Vite frontend (TypeScript)
│   └── src/
│       ├── api/       # Axios API client wrappers
│       ├── components/# Reusable UI components
│       ├── context/   # React context (auth, etc.)
│       ├── hooks/     # Custom hooks
│       ├── pages/     # Page-level components
│       ├── routes/    # React Router route definitions
│       ├── services/  # chatService (fetch + socket)
│       └── types/     # Shared TypeScript types
├── tests/             # Jest integration tests
│   ├── auth.test.ts
│   └── WebServer/
│       ├── recipe.test.ts
│       └── user.test.ts
└── data/
    └── uploads/       # Persisted user avatar images (gitignored)
        └── avatars/
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express 5, TypeScript |
| Database | MongoDB (Mongoose) |
| Auth | JWT (access + refresh tokens), bcrypt |
| OAuth | Google OAuth 2.0, Facebook OAuth 2.0 |
| File uploads | Multer (disk storage) |
| Real-time | Socket.io |
| API docs | Swagger UI (`/api-docs`) |
| Frontend | React 18, TypeScript, Vite 5 |
| Routing | React Router v7 |
| HTTP client | Axios |
| Testing | Jest, ts-jest, Supertest |

---

## Project Structure

### Backend models

| Model | Description |
|---|---|
| `User` | username, email, password (hashed), provider (`local`/`google`/`facebook`), providerId, profilePicture |
| `RefreshToken` | userId ref, token string, expiresAt |
| `Comment` | recipeId, userId, content, timestamps |
| `Like` | recipeId, userId (unique pair) |
| `ChatMessage` | senderId, receiverId, message, isRead |

### Frontend pages

| Page | Path |
|---|---|
| Login / Register | `/login` |
| Home / Feed | `/` |
| Profile | `/profile` |
| Chat | `/chat` |

---

## Environment Variables

Create a `.env` file in the project root (`recipeWebApp/.env`):

```env
# Server
PORT=4000
NODE_ENV=development          # use "production" for deployment
SERVER_ORIGIN=http://localhost:4000   # base URL used to build avatar image URLs stored in DB

# CORS — allowed origins for the API
SERVER_ADDRESS=your_school_server_address (production)
CLIENT_ORIGIN=http://localhost:5173                  # Vite dev server (development)

# MongoDB (option 1 — individual parts)
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=your_mongo_username
MONGO_PASSWORD=your_mongo_password
MONGO_DB=recipes
MONGO_AUTH_DB=admin

# MongoDB (option 2 — full URI, takes priority over individual parts)
# MONGO_URL=mongodb://user:pass@host:port/dbname?authSource=admin

# JWT
JWT_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_ACCESS_EXPIRATION=3600        # seconds (default: 1 hour)
JWT_REFRESH_EXPIRATION=604800     # seconds (default: 7 days)

# OAuth — Google
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_CALLBACK_BASE_URL=http://localhost:4000   # base for /api/auth/google/callback

# OAuth — Facebook
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
OAUTH_STATE_SECRET=your_state_signing_secret    # optional, falls back to JWT_SECRET
```

> **Important:** `SERVER_ORIGIN` is used to build the `profilePicture` URL that gets saved in MongoDB (`${SERVER_ORIGIN}/uploads/avatars/filename.jpg`). Set it to the public-facing server URL in production.

---

## Getting Started

### 1. Install dependencies

```bash
# Backend
npm install

# Frontend
cd client && npm install && cd ..
```

### 2. Configure `.env`

Copy the template above and fill in your values.

### 3. Run in development

Open two terminals:

```bash
# Terminal 1 — backend (port 4000, hot-reload)
npm run dev

# Terminal 2 — frontend (port 5173, hot-reload)
cd client && npm run dev
```

The Vite dev server proxies `/api`, `/socket.io`, and `/uploads` to `http://localhost:4000`, so everything works from `http://localhost:5173`.

### 4. Run in production

```bash
# Build both
npm run build
cd client && npm run build && cd ..

# Start server (serves client/dist at root)
npm start
```

The Express server serves the compiled React app from `client/dist/` and the backend API on the same port (4000).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start backend with ts-node-dev (hot-reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled backend |
| `npm test` | Compile + run all Jest tests (sequential, force-exit) |
| `cd client && npm run dev` | Start Vite dev server (port 5173) |
| `cd client && npm run build` | Build React app to `client/dist/` |

---

## API Reference

Interactive docs are available at **`http://localhost:4000/api-docs`** (Swagger UI).

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register with username, email, password |
| POST | `/login` | — | Login, returns access + refresh tokens |
| POST | `/logout` | Bearer | Invalidates refresh token |
| POST | `/refresh` | — | Rotate refresh token, get new access token |
| GET | `/google` | — | Redirect to Google OAuth consent screen |
| GET | `/google/callback` | — | Google OAuth callback |
| GET | `/facebook` | — | Redirect to Facebook login dialog |
| GET | `/facebook/callback` | — | Facebook OAuth callback |

### Users — `/api/users`

All endpoints require `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/me` | Get the current user's profile (DB lookup, always fresh) |
| PUT | `/me` | Update username/bio + upload avatar (`multipart/form-data`, field: `avatar`) |
| GET | `/` | List all users except self (used by Chat user-picker) |
| GET | `/:id` | Get any user by MongoDB ObjectId |
| PUT | `/:id` | Admin: update any user |
| DELETE | `/:id` | Admin: delete user (cascades comments + refresh tokens) |

### Recipes — `/api/recipes`

All endpoints require `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/:recipeId/comments` | Add a comment to a recipe |
| POST | `/:recipeId/likes` | Toggle like on a recipe |

### Chat — `/api/chat`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/history/:partnerId` | Bearer | Fetch message history with a specific user |

---

## Authentication

**Access token** — short-lived JWT (`1h` default). Payload: `{ id, username, email }`. Sent as `Authorization: Bearer <token>`.

**Refresh token** — long-lived JWT (`7d` default) stored in MongoDB. On `/refresh`, the old token is deleted and a new pair is issued (rotation). Double-use of a refresh token returns `403`.

**`verifyToken` middleware** — validates the Bearer token and attaches `req.user.id` to the request. Used on all protected routes.

**Important:** Comments and likes use `req.user.id` from the JWT — never a `userId` in the request body.

---

## File Uploads

- Handled by **Multer** with disk storage.
- Uploaded files are saved to `data/uploads/<subfolder>/` (gitignored).
- The factory `createUpload(subfolder)` in `src/middleware/upload.ts` creates a scoped multer instance.
- Avatar uploads: `PUT /api/users/me` with `Content-Type: multipart/form-data`, field name `avatar`.
- Allowed types: `image/jpeg`, `image/png`, `image/webp`. Max size: **5 MB**.
- The stored `profilePicture` value in MongoDB is a full URL: `${SERVER_ORIGIN}/uploads/avatars/filename.jpg`.
- The Express server exposes `data/uploads/` at `/uploads` (static middleware).
- In development, Vite proxies `/uploads → http://localhost:4000`.

---

## Real-Time Chat (Socket.io)

The server initialises Socket.io on the same HTTP server as Express.

| Event (client → server) | Payload | Description |
|---|---|---|
| `join` | `userId: string` | Join a private room keyed by the user's MongoDB ID |
| `send_message` | `{ tempId, senderId, receiverId, message }` | Send a message; persisted to MongoDB |
| `mark_as_read` | `{ messageId, senderId }` | Mark a message as read; notifies sender |

| Event (server → client) | Payload | Description |
|---|---|---|
| `receive_message` | Saved `ChatMessage` document | Delivered to the receiver's private room |
| `message_received_ack` | `{ tempId, permanentId, status }` | Confirms delivery to sender (shows ✓ icon) |
| `message_read_update` | `{ messageId }` | Notifies sender that message was read |
| `message_error` | `{ tempId, error }` | Sent to sender if DB save fails |

---

## OAuth (Google & Facebook)

OAuth uses a **stateless CSRF state token** signed with `OAUTH_STATE_SECRET`.

Flow:
1. Client navigates to `/api/auth/google` or `/api/auth/facebook`.
2. Server generates a signed state token and redirects to the provider.
3. Provider redirects back to `/api/auth/google/callback?code=...&state=...`.
4. Server verifies state, exchanges code for a profile, upserts the user in MongoDB, and redirects the client to the frontend with `accessToken` and `refreshToken` as query params.

**Account merge:** If a user with the same email already exists (created via local registration), the existing account is linked to the OAuth provider instead of creating a duplicate.

OAuth profile picture sizes:
- Google: `=s400-c` (400×400 px)
- Facebook: `picture.type(large)`

---

## Running Tests

Tests use **Jest + Supertest** against a real MongoDB connection (not an in-memory mock). Ensure your `.env` is configured and the MongoDB server is reachable before running.

```bash
npm test
```

Tests run **sequentially** (`--runInBand`) to avoid database race conditions.

### Test suites

| Suite | File | Coverage |
|---|---|---|
| Auth | `tests/auth.test.ts` | Register, login, refresh token, logout, double-use prevention, OAuth callbacks, account merge |
| Recipe | `tests/WebServer/recipe.test.ts` | Comments (create, 401, 400), likes (toggle, 401) |
| User | `tests/WebServer/user.test.ts` | `GET /me`, `GET /`, `GET /:id`, `PUT /me` (username + avatar), `PUT /:id`, `DELETE /:id` |

### Important test conventions

- Each suite cleans up **only its own test users** by email — it does not wipe the whole collection.
- Refresh tokens are also scoped: deleted only for the test user IDs, not globally.
- The user test creates a 1×1 PNG fixture programmatically in `beforeAll` and removes it in `afterAll` — no binary file committed to git.

---

## Deployment Notes

When deploying to the school server (or any remote host):

1. Set `NODE_ENV=production` in `.env`.
2. Set `SERVER_ORIGIN` to the public server URL (e.g. `your_school_server_address`) — this is what gets saved as the avatar URL in MongoDB.
3. Set `CLIENT_ORIGIN` to the public frontend URL (used for CORS).
4. Set `OAUTH_CALLBACK_BASE_URL` to the public server URL so OAuth redirects work.
5. Build both backend and frontend: `npm run build` + `cd client && npm run build`.
6. The backend serves the React app from `client/dist/` on the same port — no separate frontend server needed.
7. `data/uploads/` is gitignored. Make sure the directory exists on the server and is writable by the Node process.
8. In production, Socket.io CORS is restricted to `SERVER_ADDRESS` only (not `*`).

# recipeWebApp

A TypeScript-based web application for managing recipes.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```env
PORT=4000
NODE_ENV=development
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=your_mongo_username
MONGO_PASSWORD=your_mongo_password
MONGO_DB=recipes
MONGO_AUTH_DB=admin
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_postgres_username
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=recipes
```

## Running the Application

```bash
npm run build
npm start
```

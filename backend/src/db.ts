import mongoose from "mongoose";

function buildMongoUriFromParts(): string {
  const {
    MONGO_HOST,
    MONGO_PORT,
    MONGO_USER,
    MONGO_PASSWORD,
    MONGO_DB,
    MONGO_AUTH_DB,
  } = process.env;

  if (!MONGO_HOST || !MONGO_PORT || !MONGO_USER || !MONGO_PASSWORD || !MONGO_DB) {
    throw new Error("Missing Mongo env vars. Check your .env");
  }

  const authDb = MONGO_AUTH_DB || "admin";

  const user = encodeURIComponent(MONGO_USER);
  const pass = encodeURIComponent(MONGO_PASSWORD);

  return `mongodb://${user}:${pass}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=${authDb}`;
}

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGO_URL || buildMongoUriFromParts();

  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000, // fail fast if VPN is off / no access
    });

    console.log("✅ MongoDB connected");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ MongoDB connection failed:", msg);
    process.exit(1);
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

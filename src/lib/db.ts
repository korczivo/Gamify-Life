import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/empire";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Cached across HMR reloads in dev — a fresh connection per reload would
// exhaust the connection pool.
const globalWithMongoose = globalThis as typeof globalThis & {
  __mongoose?: MongooseCache;
};

const cache: MongooseCache = globalWithMongoose.__mongoose ?? {
  conn: null,
  promise: null,
};
globalWithMongoose.__mongoose = cache;

/**
 * Dev-only: drop a compiled model so the module re-registers it below. The
 * mongoose instance is cached across HMR reloads, so plain
 * `mongoose.models.X ?? mongoose.model(...)` would keep serving the OLD
 * schema after an edit — new fields get silently stripped on save.
 * (Regex form: no throw when the model isn't registered yet.)
 */
export function dropModelInDev(name: string): void {
  if (process.env.NODE_ENV !== "production") {
    mongoose.deleteModel(new RegExp(`^${name}$`));
  }
}

export async function dbConnect(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}

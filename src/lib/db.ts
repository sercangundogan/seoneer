import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";
import { env } from "./env";

const globalForDb = globalThis as unknown as { conn?: ReturnType<typeof postgres> };

function createClient() {
  const isLocal =
    env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1");

  return postgres(env.DATABASE_URL, {
    prepare: false, // required for Supabase transaction pooler / PgBouncer
    max: 10,
    ssl: isLocal ? false : "require",
  });
}

export const conn = globalForDb.conn ?? createClient();
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
export { schema };

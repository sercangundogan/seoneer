import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";
import { env } from "./env";

const globalForDb = globalThis as unknown as { conn?: ReturnType<typeof postgres> };

function createClient() {
  return postgres(env.DATABASE_URL, { prepare: false, max: 10 });
}

export const conn = globalForDb.conn ?? createClient();
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
export { schema };

import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function getDb() {
  const { DATABASE_URL } = env as unknown as { DATABASE_URL?: string };

  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is unavailable. Create .dev.vars from .dev.vars.example before using the database."
    );
  }

  const client = postgres(DATABASE_URL, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
  });

  return drizzle(client, { schema });
}

import { sql } from "drizzle-orm";
import { getDb } from "../../../../db";

export async function GET() {
  try {
    const db = getDb();
    await db.execute(sql`select 1 as connected`);

    return Response.json({ database: "connected" });
  } catch (error) {
    console.error("Database health check failed", error);

    return Response.json(
      { database: "unavailable", error: "No se pudo conectar con PostgreSQL" },
      { status: 503 },
    );
  }
}

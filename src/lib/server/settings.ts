import "server-only";
import { eq } from "drizzle-orm";
import { schema, type DB, type Tx } from "@/db";

export type Settings = typeof schema.settings.$inferSelect;

export async function getSettings(db: DB | Tx): Promise<Settings> {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();
  const again = await db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1);
  return again[0];
}

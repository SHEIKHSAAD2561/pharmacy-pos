import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { body, idParam, notFound, route } from "@/lib/server/api";
import { SupplierInput } from "@/lib/server/validation";

const s = schema.suppliers;

export const PUT = route<{ id: string }>(
  async ({ req, db, params }) => {
    const input = await body(req, SupplierInput.partial());
    const [row] = await db.update(s).set(input).where(eq(s.id, idParam(params.id))).returning();
    if (!row) throw notFound("Supplier");
    return row;
  },
  { roles: ["admin", "pharmacist"] },
);

export const DELETE = route<{ id: string }>(
  async ({ db, params }) => {
    const id = idParam(params.id);
    try {
      await db.delete(s).where(eq(s.id, id));
      return { deleted: true };
    } catch {
      await db.update(s).set({ active: false }).where(eq(s.id, id));
      return { deleted: false, deactivated: true };
    }
  },
  { roles: ["admin"] },
);

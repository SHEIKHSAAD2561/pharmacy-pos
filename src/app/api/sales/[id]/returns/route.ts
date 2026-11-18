import { body, idParam, route } from "@/lib/server/api";
import { createReturn, ReturnInput } from "@/lib/server/sales";
import { getSettings } from "@/lib/server/settings";

export const POST = route<{ id: string }>(
  async ({ req, db, user, params }) => {
    const input = await body(req, ReturnInput);
    return db.transaction(async (tx) => {
      const settings = await getSettings(tx);
      return createReturn(tx, idParam(params.id), input, user, settings);
    });
  },
  { roles: ["admin", "pharmacist"] },
);

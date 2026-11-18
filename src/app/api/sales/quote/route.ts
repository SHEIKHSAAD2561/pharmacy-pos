import { body, route } from "@/lib/server/api";
import { QuoteInput, quoteSale } from "@/lib/server/sales";
import { getSettings } from "@/lib/server/settings";

/** Price preview for the POS cart (no stock is reserved). */
export const POST = route(async ({ req, db }) => {
  const input = await body(req, QuoteInput);
  return db.transaction(async (tx) => {
    const settings = await getSettings(tx);
    return quoteSale(tx, input, settings);
  });
});

import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { badRequest, body, route } from "@/lib/server/api";
import { getSettings } from "@/lib/server/settings";

export const GET = route(async ({ db }) => getSettings(db));

const Update = z
  .object({
    pharmacyName: z.string().min(2),
    legalName: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
    phone: z.string(),
    email: z.string(),
    website: z.string(),
    licenseNumber: z.string(),
    taxNumber: z.string(),
    currencyCode: z.string().length(3),
    currencySymbol: z.string().max(6),
    currencyDecimals: z.number().int().min(0).max(4),
    locale: z.string().min(2),
    timezone: z.string().min(1),
    taxName: z.string(),
    taxRate: z.number().min(0).max(100),
    pricesIncludeTax: z.boolean(),
    invoicePrefix: z.string().min(1).max(10),
    receiptHeader: z.string(),
    receiptFooter: z.string(),
    lowStockThreshold: z.number().int().min(0),
    expiryAlertDays: z.number().int().min(1).max(730),
    blockExpiredSales: z.boolean(),
    requirePrescriptionCheck: z.boolean(),
    loyaltyEnabled: z.boolean(),
    loyaltyPointsPerUnit: z.number().min(0),
    loyaltyPointValue: z.number().min(0),
  })
  .partial();

export const PUT = route(
  async ({ req, db }) => {
    const input = await body(req, Update);
    if (input.currencyCode) {
      input.currencyCode = input.currencyCode.toUpperCase();
      try {
        new Intl.NumberFormat("en-US", { style: "currency", currency: input.currencyCode });
      } catch {
        throw badRequest(`Unknown currency code "${input.currencyCode}"`);
      }
    }
    if (input.timezone) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
      } catch {
        throw badRequest(`Unknown time zone "${input.timezone}"`);
      }
    }
    await getSettings(db);
    await db
      .update(schema.settings)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.settings.id, 1));
    return getSettings(db);
  },
  { roles: ["admin"] },
);

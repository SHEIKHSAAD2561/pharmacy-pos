import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { schema } from "@/db";
import { ApiError, body, route } from "@/lib/server/api";
import { createSession, hashPassword } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { seedDemoData } from "@/lib/server/seed";

export const GET = route(
  async ({ db }) => {
    const [{ value: userCount }] = await db.select({ value: count() }).from(schema.users);
    const settings = await getSettings(db);
    return {
      needsSetup: userCount === 0,
      pharmacyName: settings.pharmacyName,
    };
  },
  { public: true },
);

const Setup = z.object({
  pharmacy: z.object({
    pharmacyName: z.string().min(2),
    legalName: z.string().default(""),
    address: z.string().default(""),
    city: z.string().default(""),
    country: z.string().default(""),
    phone: z.string().default(""),
    email: z.string().default(""),
    licenseNumber: z.string().default(""),
    taxNumber: z.string().default(""),
    currencyCode: z.string().length(3),
    currencySymbol: z.string().default(""),
    currencyDecimals: z.number().int().min(0).max(4).default(2),
    taxName: z.string().default("VAT"),
    taxRate: z.number().min(0).max(100).default(0),
    pricesIncludeTax: z.boolean().default(false),
    timezone: z.string().default("UTC"),
  }),
  admin: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
  demoData: z.boolean().default(false),
});

export const POST = route(
  async ({ req, db }) => {
    const input = await body(req, Setup);
    const [{ value: userCount }] = await db.select({ value: count() }).from(schema.users);
    if (userCount > 0) throw new ApiError(409, "This pharmacy has already been set up");

    await getSettings(db);
    await db
      .update(schema.settings)
      .set({
        ...input.pharmacy,
        currencyCode: input.pharmacy.currencyCode.toUpperCase(),
        setupCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.settings.id, 1));

    const [admin] = await db
      .insert(schema.users)
      .values({
        name: input.admin.name,
        email: input.admin.email.toLowerCase(),
        passwordHash: await hashPassword(input.admin.password),
        role: "admin",
      })
      .returning();

    if (input.demoData) await seedDemoData(db, admin.id);

    await createSession(admin.id);
    return { ok: true };
  },
  { public: true },
);

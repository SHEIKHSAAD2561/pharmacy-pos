import { z } from "zod";

export const ProductInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  genericName: z.string().default(""),
  brand: z.string().default(""),
  manufacturer: z.string().default(""),
  categoryId: z.number().int().nullable().default(null),
  dosageForm: z.string().default(""),
  strength: z.string().default(""),
  packSize: z.string().default(""),
  unit: z.string().default("pcs"),
  sku: z.string().default(""),
  barcode: z
    .string()
    .nullable()
    .default(null)
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  description: z.string().default(""),
  sellPrice: z.number().min(0),
  costPrice: z.number().min(0).default(0),
  taxable: z.boolean().default(true),
  requiresPrescription: z.boolean().default(false),
  controlled: z.boolean().default(false),
  reorderLevel: z.number().int().min(0).default(10),
  shelfLocation: z.string().default(""),
  storage: z.string().default(""),
  active: z.boolean().default(true),
});

export const SupplierInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  contactPerson: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  taxNumber: z.string().default(""),
  paymentTerms: z.string().default(""),
  notes: z.string().default(""),
  active: z.boolean().default(true),
});

export const CustomerInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().default(""),
  email: z.string().default(""),
  dateOfBirth: z
    .string()
    .nullable()
    .default(null)
    .transform((v) => (v ? v : null)),
  gender: z.string().default(""),
  address: z.string().default(""),
  allergies: z.string().default(""),
  chronicConditions: z.string().default(""),
  insuranceProvider: z.string().default(""),
  insuranceNumber: z.string().default(""),
  insuranceCoverage: z.number().min(0).max(100).default(0),
  notes: z.string().default(""),
});

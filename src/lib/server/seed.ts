import "server-only";
import { eq, inArray } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { hashPassword } from "./auth";
import { createSale } from "./sales";
import { getSettings } from "./settings";
import { addDaysISO } from "./api";

type P = {
  name: string;
  generic: string;
  cat: string;
  form: string;
  strength: string;
  pack: string;
  mfr: string;
  price: number;
  cost: number;
  rx?: boolean;
  controlled?: boolean;
  storage?: string;
  shelf: string;
};

const CATEGORIES: [string, string][] = [
  ["Pain & Fever", "rose"],
  ["Antibiotics", "violet"],
  ["Cardiovascular", "red"],
  ["Diabetes", "blue"],
  ["Respiratory", "cyan"],
  ["Gastrointestinal", "amber"],
  ["Allergy", "lime"],
  ["Vitamins & Supplements", "emerald"],
  ["Dermatology", "pink"],
  ["Baby & Mother", "sky"],
  ["Personal Care", "teal"],
  ["Medical Devices", "slate"],
];

const PRODUCTS: P[] = [
  { name: "Panadol", generic: "Paracetamol", cat: "Pain & Fever", form: "Tablet", strength: "500 mg", pack: "24 tablets", mfr: "GSK", price: 4.5, cost: 2.6, shelf: "A1" },
  { name: "Panadol Extra", generic: "Paracetamol + Caffeine", cat: "Pain & Fever", form: "Tablet", strength: "500/65 mg", pack: "24 tablets", mfr: "GSK", price: 5.75, cost: 3.2, shelf: "A1" },
  { name: "Brufen", generic: "Ibuprofen", cat: "Pain & Fever", form: "Tablet", strength: "400 mg", pack: "30 tablets", mfr: "Abbott", price: 6.2, cost: 3.4, shelf: "A2" },
  { name: "Voltaren Emulgel", generic: "Diclofenac", cat: "Pain & Fever", form: "Gel", strength: "1%", pack: "50 g", mfr: "Haleon", price: 9.9, cost: 5.8, shelf: "A3" },
  { name: "Aspirin Protect", generic: "Acetylsalicylic acid", cat: "Cardiovascular", form: "Tablet", strength: "100 mg", pack: "30 tablets", mfr: "Bayer", price: 5.1, cost: 2.7, shelf: "C1" },
  { name: "Tramadol", generic: "Tramadol", cat: "Pain & Fever", form: "Capsule", strength: "50 mg", pack: "20 capsules", mfr: "Grünenthal", price: 12.5, cost: 7.1, rx: true, controlled: true, shelf: "Locked cabinet" },
  { name: "Augmentin", generic: "Amoxicillin + Clavulanic acid", cat: "Antibiotics", form: "Tablet", strength: "625 mg", pack: "14 tablets", mfr: "GSK", price: 14.8, cost: 9.1, rx: true, shelf: "B1" },
  { name: "Amoxil", generic: "Amoxicillin", cat: "Antibiotics", form: "Capsule", strength: "500 mg", pack: "16 capsules", mfr: "GSK", price: 8.4, cost: 4.9, rx: true, shelf: "B1" },
  { name: "Zithromax", generic: "Azithromycin", cat: "Antibiotics", form: "Tablet", strength: "500 mg", pack: "3 tablets", mfr: "Pfizer", price: 16.2, cost: 10.3, rx: true, shelf: "B2" },
  { name: "Ciprobay", generic: "Ciprofloxacin", cat: "Antibiotics", form: "Tablet", strength: "500 mg", pack: "10 tablets", mfr: "Bayer", price: 13.6, cost: 8.2, rx: true, shelf: "B2" },
  { name: "Concor", generic: "Bisoprolol", cat: "Cardiovascular", form: "Tablet", strength: "5 mg", pack: "30 tablets", mfr: "Merck", price: 11.3, cost: 6.4, rx: true, shelf: "C1" },
  { name: "Norvasc", generic: "Amlodipine", cat: "Cardiovascular", form: "Tablet", strength: "5 mg", pack: "30 tablets", mfr: "Pfizer", price: 12.9, cost: 7.3, rx: true, shelf: "C2" },
  { name: "Lipitor", generic: "Atorvastatin", cat: "Cardiovascular", form: "Tablet", strength: "20 mg", pack: "30 tablets", mfr: "Pfizer", price: 24.5, cost: 15.2, rx: true, shelf: "C2" },
  { name: "Glucophage", generic: "Metformin", cat: "Diabetes", form: "Tablet", strength: "850 mg", pack: "30 tablets", mfr: "Merck", price: 6.8, cost: 3.6, rx: true, shelf: "D1" },
  { name: "Januvia", generic: "Sitagliptin", cat: "Diabetes", form: "Tablet", strength: "100 mg", pack: "28 tablets", mfr: "MSD", price: 48.0, cost: 33.5, rx: true, shelf: "D1" },
  { name: "Lantus SoloStar", generic: "Insulin glargine", cat: "Diabetes", form: "Injection pen", strength: "100 IU/ml", pack: "5 pens", mfr: "Sanofi", price: 72.0, cost: 52.0, rx: true, storage: "Refrigerate 2–8 °C", shelf: "Fridge 1" },
  { name: "Accu-Chek Test Strips", generic: "Blood glucose strips", cat: "Medical Devices", form: "Strips", strength: "", pack: "50 strips", mfr: "Roche", price: 19.5, cost: 12.0, shelf: "M1" },
  { name: "Ventolin Inhaler", generic: "Salbutamol", cat: "Respiratory", form: "Inhaler", strength: "100 mcg", pack: "200 doses", mfr: "GSK", price: 7.9, cost: 4.4, rx: true, shelf: "E1" },
  { name: "Symbicort Turbuhaler", generic: "Budesonide + Formoterol", cat: "Respiratory", form: "Inhaler", strength: "160/4.5 mcg", pack: "120 doses", mfr: "AstraZeneca", price: 39.0, cost: 26.0, rx: true, shelf: "E1" },
  { name: "Mucosolvan Syrup", generic: "Ambroxol", cat: "Respiratory", form: "Syrup", strength: "15 mg/5 ml", pack: "100 ml", mfr: "Sanofi", price: 6.3, cost: 3.5, shelf: "E2" },
  { name: "Otrivin Nasal Spray", generic: "Xylometazoline", cat: "Respiratory", form: "Nasal spray", strength: "0.1%", pack: "10 ml", mfr: "Haleon", price: 5.4, cost: 2.9, shelf: "E2" },
  { name: "Nexium", generic: "Esomeprazole", cat: "Gastrointestinal", form: "Tablet", strength: "40 mg", pack: "14 tablets", mfr: "AstraZeneca", price: 17.8, cost: 11.0, rx: true, shelf: "F1" },
  { name: "Gaviscon Advance", generic: "Sodium alginate", cat: "Gastrointestinal", form: "Suspension", strength: "", pack: "300 ml", mfr: "Reckitt", price: 8.9, cost: 5.1, shelf: "F1" },
  { name: "Imodium", generic: "Loperamide", cat: "Gastrointestinal", form: "Capsule", strength: "2 mg", pack: "12 capsules", mfr: "Kenvue", price: 6.1, cost: 3.3, shelf: "F2" },
  { name: "Buscopan", generic: "Hyoscine butylbromide", cat: "Gastrointestinal", form: "Tablet", strength: "10 mg", pack: "20 tablets", mfr: "Sanofi", price: 5.9, cost: 3.2, shelf: "F2" },
  { name: "ORS Rehydration Salts", generic: "Oral rehydration salts", cat: "Gastrointestinal", form: "Sachet", strength: "", pack: "10 sachets", mfr: "Generic", price: 3.2, cost: 1.4, shelf: "F3" },
  { name: "Claritine", generic: "Loratadine", cat: "Allergy", form: "Tablet", strength: "10 mg", pack: "20 tablets", mfr: "Bayer", price: 7.2, cost: 3.9, shelf: "G1" },
  { name: "Zyrtec", generic: "Cetirizine", cat: "Allergy", form: "Tablet", strength: "10 mg", pack: "20 tablets", mfr: "UCB", price: 6.9, cost: 3.7, shelf: "G1" },
  { name: "Telfast", generic: "Fexofenadine", cat: "Allergy", form: "Tablet", strength: "180 mg", pack: "15 tablets", mfr: "Sanofi", price: 9.4, cost: 5.6, shelf: "G1" },
  { name: "Centrum Advance", generic: "Multivitamin", cat: "Vitamins & Supplements", form: "Tablet", strength: "", pack: "60 tablets", mfr: "Haleon", price: 18.9, cost: 11.2, shelf: "H1" },
  { name: "Vitamin D3", generic: "Cholecalciferol", cat: "Vitamins & Supplements", form: "Softgel", strength: "5000 IU", pack: "60 softgels", mfr: "Nature Made", price: 11.5, cost: 6.0, shelf: "H1" },
  { name: "Omega-3 Fish Oil", generic: "Omega-3 fatty acids", cat: "Vitamins & Supplements", form: "Softgel", strength: "1000 mg", pack: "90 softgels", mfr: "Nature Made", price: 15.9, cost: 8.7, shelf: "H2" },
  { name: "Vitamin C Effervescent", generic: "Ascorbic acid", cat: "Vitamins & Supplements", form: "Effervescent tablet", strength: "1000 mg", pack: "20 tablets", mfr: "Redoxon", price: 7.5, cost: 3.9, shelf: "H2" },
  { name: "Ferrous Sulfate", generic: "Iron", cat: "Vitamins & Supplements", form: "Tablet", strength: "200 mg", pack: "28 tablets", mfr: "Generic", price: 4.2, cost: 1.9, shelf: "H3" },
  { name: "Fucidin Cream", generic: "Fusidic acid", cat: "Dermatology", form: "Cream", strength: "2%", pack: "15 g", mfr: "LEO Pharma", price: 8.6, cost: 4.8, rx: true, shelf: "I1" },
  { name: "Bepanthen Ointment", generic: "Dexpanthenol", cat: "Baby & Mother", form: "Ointment", strength: "5%", pack: "30 g", mfr: "Bayer", price: 7.8, cost: 4.3, shelf: "J1" },
  { name: "Calpol Infant Suspension", generic: "Paracetamol", cat: "Baby & Mother", form: "Suspension", strength: "120 mg/5 ml", pack: "100 ml", mfr: "Kenvue", price: 5.6, cost: 3.0, shelf: "J1" },
  { name: "Pampers Baby Dry Size 4", generic: "Diapers", cat: "Baby & Mother", form: "Diaper", strength: "", pack: "46 pcs", mfr: "P&G", price: 16.5, cost: 11.4, shelf: "J2" },
  { name: "Cetaphil Gentle Cleanser", generic: "Skin cleanser", cat: "Personal Care", form: "Lotion", strength: "", pack: "250 ml", mfr: "Galderma", price: 13.2, cost: 7.9, shelf: "K1" },
  { name: "La Roche-Posay Anthelios SPF50", generic: "Sunscreen", cat: "Personal Care", form: "Cream", strength: "SPF 50", pack: "50 ml", mfr: "L'Oréal", price: 22.0, cost: 13.5, shelf: "K1" },
  { name: "Hand Sanitizer", generic: "Ethyl alcohol 70%", cat: "Personal Care", form: "Gel", strength: "70%", pack: "500 ml", mfr: "Dettol", price: 4.9, cost: 2.4, shelf: "K2" },
  { name: "Omron M3 BP Monitor", generic: "Blood pressure monitor", cat: "Medical Devices", form: "Device", strength: "", pack: "1 unit", mfr: "Omron", price: 59.0, cost: 38.0, shelf: "M2" },
  { name: "Digital Thermometer", generic: "Thermometer", cat: "Medical Devices", form: "Device", strength: "", pack: "1 unit", mfr: "Microlife", price: 8.5, cost: 4.2, shelf: "M2" },
  { name: "Surgical Face Masks", generic: "Face mask", cat: "Medical Devices", form: "Mask", strength: "", pack: "50 pcs", mfr: "3M", price: 6.0, cost: 2.8, shelf: "M3" },
];

const SUPPLIERS = [
  { name: "MedLine Distribution", contactPerson: "Omar Haddad", phone: "+1 555 0101", email: "orders@medline.example", paymentTerms: "Net 30", address: "12 Logistics Park" },
  { name: "Global Pharma Supply", contactPerson: "Sarah Klein", phone: "+1 555 0145", email: "sales@globalpharma.example", paymentTerms: "Net 45", address: "88 Harbor Road" },
  { name: "HealthFirst Wholesale", contactPerson: "Ravi Patel", phone: "+1 555 0177", email: "support@healthfirst.example", paymentTerms: "Net 15", address: "5 Industrial Ave" },
];

const CUSTOMERS = [
  { name: "Ahmed Al-Farsi", phone: "+1 555 2001", email: "ahmed@example.com", gender: "Male", dateOfBirth: "1978-04-12", allergies: "Penicillin", chronicConditions: "Hypertension", insuranceProvider: "Bupa", insuranceNumber: "BU-552190", insuranceCoverage: 80 },
  { name: "Maria Gonzalez", phone: "+1 555 2002", email: "maria@example.com", gender: "Female", dateOfBirth: "1990-09-03", allergies: "", chronicConditions: "Asthma", insuranceProvider: "AXA", insuranceNumber: "AX-883201", insuranceCoverage: 70 },
  { name: "John Smith", phone: "+1 555 2003", email: "john.smith@example.com", gender: "Male", dateOfBirth: "1955-01-22", allergies: "Sulfa", chronicConditions: "Type 2 diabetes, High cholesterol", insuranceProvider: "Allianz", insuranceNumber: "AL-100293", insuranceCoverage: 90 },
  { name: "Fatima Noor", phone: "+1 555 2004", email: "fatima@example.com", gender: "Female", dateOfBirth: "1986-12-15", allergies: "Aspirin", chronicConditions: "", insuranceProvider: "", insuranceNumber: "", insuranceCoverage: 0 },
  { name: "Liam O'Connor", phone: "+1 555 2005", email: "liam@example.com", gender: "Male", dateOfBirth: "2001-06-30", allergies: "", chronicConditions: "", insuranceProvider: "", insuranceNumber: "", insuranceCoverage: 0 },
  { name: "Chen Wei", phone: "+1 555 2006", email: "chen.wei@example.com", gender: "Female", dateOfBirth: "1969-03-08", allergies: "", chronicConditions: "Arthritis", insuranceProvider: "Cigna", insuranceNumber: "CG-447812", insuranceCoverage: 60 },
];

function rand(seed: { v: number }) {
  seed.v = (seed.v * 1664525 + 1013904223) % 4294967296;
  return seed.v / 4294967296;
}

export async function seedDemoData(db: DB, adminId: number) {
  const seed = { v: 42 };
  const r = () => rand(seed);

  await db.transaction(async (tx) => {
    // Staff
    const [pharmacist] = await tx
      .insert(schema.users)
      .values([
        { name: "Dr. Layla Hassan", email: "pharmacist@demo.pharmacy", role: "pharmacist", passwordHash: await hashPassword("demo1234") },
        { name: "Sam Carter", email: "cashier@demo.pharmacy", role: "cashier", passwordHash: await hashPassword("demo1234") },
      ])
      .returning();

    const cats = await tx
      .insert(schema.categories)
      .values(CATEGORIES.map(([name, color]) => ({ name, color })))
      .onConflictDoNothing()
      .returning();
    const catId = new Map(cats.map((c) => [c.name, c.id]));

    const sups = await tx.insert(schema.suppliers).values(SUPPLIERS).returning();

    const products = await tx
      .insert(schema.products)
      .values(
        PRODUCTS.map((p, i) => ({
          name: p.name,
          genericName: p.generic,
          brand: p.name.split(" ")[0],
          manufacturer: p.mfr,
          categoryId: catId.get(p.cat) ?? null,
          dosageForm: p.form,
          strength: p.strength,
          packSize: p.pack,
          unit: "pack",
          sku: `MED-${String(i + 1).padStart(5, "0")}`,
          barcode: String(6290000000000 + (i + 1) * 7919),
          sellPrice: p.price,
          costPrice: p.cost,
          requiresPrescription: !!p.rx || !!p.controlled,
          controlled: !!p.controlled,
          reorderLevel: p.price > 40 ? 3 : 10,
          shelfLocation: p.shelf,
          storage: p.storage ?? "Store below 25 °C",
          taxable: true,
        })),
      )
      .returning();

    // Batches: most healthy, some near expiry, one expired, a few low / out of stock
    for (const [i, p] of products.entries()) {
      const supplier = sups[i % sups.length];
      const rows: (typeof schema.batches.$inferInsert)[] = [];
      if (i % 13 === 5) {
        // out of stock: no batches
      } else {
        const qtyA = i % 9 === 3 ? 4 : 20 + Math.floor(r() * 60);
        rows.push({
          productId: p.id,
          batchNumber: `B${24000 + i * 3}`,
          expiryDate: i % 7 === 2 ? addDaysISO(25 + i) : addDaysISO(240 + Math.floor(r() * 500)),
          quantity: qtyA,
          initialQuantity: qtyA + 30,
          costPrice: p.costPrice,
          supplierId: supplier.id,
        });
        if (i % 4 === 0) {
          const qtyB = 15 + Math.floor(r() * 40);
          rows.push({
            productId: p.id,
            batchNumber: `B${25000 + i * 3}`,
            expiryDate: addDaysISO(400 + Math.floor(r() * 300)),
            quantity: qtyB,
            initialQuantity: qtyB,
            costPrice: p.costPrice,
            supplierId: supplier.id,
          });
        }
        if (i === 10 || i === 23) {
          rows.push({
            productId: p.id,
            batchNumber: `X${9000 + i}`,
            expiryDate: addDaysISO(-12),
            quantity: 6,
            initialQuantity: 20,
            costPrice: p.costPrice,
            supplierId: supplier.id,
          });
        }
      }
      if (rows.length) {
        const inserted = await tx.insert(schema.batches).values(rows).returning();
        await tx.insert(schema.stockMovements).values(
          inserted.map((b) => ({
            productId: p.id,
            batchId: b.id,
            type: "opening" as const,
            quantity: b.initialQuantity,
            reference: b.batchNumber,
            note: "Opening stock",
            userId: adminId,
          })),
        );
      }
    }

    const customers = await tx.insert(schema.customers).values(CUSTOMERS).returning();

    // Pending prescriptions
    const byName = new Map(products.map((p) => [p.name, p]));
    const rxDefs = [
      { customer: customers[0], doctor: "Dr. Karim Nasser", clinic: "City Heart Clinic", diagnosis: "Hypertension follow-up", items: [["Concor", 1, "1 tablet daily"], ["Norvasc", 1, "1 tablet daily"]] },
      { customer: customers[1], doctor: "Dr. Emily Brooks", clinic: "Downtown Medical Center", diagnosis: "Acute bronchitis", items: [["Augmentin", 1, "1 tablet twice daily for 7 days"], ["Ventolin Inhaler", 1, "2 puffs as needed"]] },
      { customer: customers[2], doctor: "Dr. Ana Silva", clinic: "Diabetes Care Institute", diagnosis: "Type 2 diabetes", items: [["Glucophage", 2, "1 tablet twice daily with meals"], ["Lipitor", 1, "1 tablet at night"]] },
    ] as const;
    for (const [idx, def] of rxDefs.entries()) {
      const [row] = await tx
        .insert(schema.prescriptions)
        .values({
          code: `RX-${String(idx + 1).padStart(6, "0")}`,
          customerId: def.customer.id,
          doctorName: def.doctor,
          clinic: def.clinic,
          doctorLicense: `LIC-${7000 + idx}`,
          issueDate: addDaysISO(-idx),
          diagnosis: def.diagnosis,
          createdBy: pharmacist.id,
        })
        .returning();
      await tx.insert(schema.prescriptionItems).values(
        def.items.map(([name, qty, dosage]) => ({
          prescriptionId: row.id,
          productId: byName.get(name)!.id,
          quantity: qty,
          dosage,
        })),
      );
    }

    // A purchase order waiting to be received
    const [po] = await tx
      .insert(schema.purchaseOrders)
      .values({ poNumber: "PO-000001", supplierId: sups[0].id, status: "ordered", expectedDate: addDaysISO(3), createdBy: adminId, notes: "Monthly restock" })
      .returning();
    const poItems = ["Panadol", "Brufen", "Centrum Advance", "Zyrtec"].map((n) => {
      const p = byName.get(n)!;
      return { purchaseOrderId: po.id, productId: p.id, quantity: 48, costPrice: p.costPrice };
    });
    await tx.insert(schema.purchaseOrderItems).values(poItems);
    const poTotal = poItems.reduce((s, i) => s + i.quantity * i.costPrice, 0);
    await tx.update(schema.purchaseOrders).set({ subtotal: poTotal, total: poTotal }).where(eq(schema.purchaseOrders.id, po.id));
  });

  // Sales history for the last 30 days (OTC items only, so no prescriptions needed)
  const settings = await getSettings(db);
  const otc = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.requiresPrescription, false));
  const customers = await db.select().from(schema.customers);
  const staff = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.role, ["admin", "pharmacist", "cashier"]));

  const saleSettings = { ...settings, requirePrescriptionCheck: false };
  const tzOffsetMs = (() => {
    try {
      const now = new Date();
      const local = new Date(now.toLocaleString("en-US", { timeZone: settings.timezone || "UTC" }));
      const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
      return local.getTime() - utc.getTime();
    } catch {
      return 0;
    }
  })();
  for (let n = 0; n < 90; n++) {
    const daysAgo = Math.floor(r() * 30);
    const lines = 1 + Math.floor(r() * 3);
    const items = new Map<number, number>();
    for (let k = 0; k < lines; k++) {
      const p = otc[Math.floor(r() * otc.length)];
      items.set(p.id, (items.get(p.id) ?? 0) + 1 + Math.floor(r() * 2));
    }
    const customer = r() < 0.55 ? customers[Math.floor(r() * customers.length)] : null;
    const user = staff[Math.floor(r() * staff.length)];
    try {
      await db.transaction(async (tx) => {
        const quoteItems = [...items].map(([productId, quantity]) => ({ productId, quantity, discount: 0 }));
        // Pay by card or cash; amount is settled after the quote inside createSale
        const sale = await createSale(
          tx,
          {
            customerId: customer?.id ?? null,
            items: quoteItems,
            discount: 0,
            useInsurance: false,
            pointsToRedeem: 0,
            payments: { cash: 1e6, card: 0, other: 0 },
            paymentReference: "",
            notes: "",
          },
          { id: user.id, name: user.name, email: user.email, role: "admin" },
          saleSettings,
        );
        // Opening hours 08:00–22:00 in the pharmacy's local time
        const day = new Date(Date.now() - daysAgo * 86400000);
        const localMidnightUtc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - tzOffsetMs;
        let when = new Date(localMidnightUtc + (8 + r() * 14) * 3600000);
        if (when.getTime() > Date.now()) when = new Date(Date.now() - r() * 3 * 3600000);
        const useCard = r() < 0.45;
        await tx
          .update(schema.sales)
          .set({
            createdAt: when,
            cashAmount: useCard ? 0 : sale.amountDue,
            cardAmount: useCard ? sale.amountDue : 0,
            changeGiven: 0,
            paymentMethod: useCard ? "card" : "cash",
          })
          .where(eq(schema.sales.id, sale.id));
      });
    } catch {
      // ignore stock shortages in random demo data
    }
  }
}

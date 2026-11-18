# PharmaPOS — Pharmacy Point of Sale

A complete point-of-sale and pharmacy management system built with **Next.js 16** (App Router), a **Node.js API** (Next.js route handlers) and **PostgreSQL** (Drizzle ORM). Designed to deploy to **Vercel** in a few clicks.

## Features

**Point of sale**
- Fast checkout with barcode/SKU scanning, product grid by category and keyboard shortcuts (F2 open POS, F4 pay, F8 scan)
- Line and order discounts (amount or %), tax-inclusive or tax-exclusive pricing
- Cash, card, and split payments with change calculation and quick-cash buttons
- Insurance co-pay on prescription items and loyalty points redemption
- Printable thermal-style tax invoice / receipt
- Register shifts with opening float, expected cash and over/short reconciliation

**Pharmacy workflow**
- Prescription records (prescriber, diagnosis, dosage, duration, instructions) and one-click dispensing at the POS
- Prescription-only (Rx) and controlled-drug rules: Rx items need an attached prescription, controlled drugs can only be dispensed by a pharmacist
- Allergy screening against the patient profile, including common drug classes (e.g. penicillin → amoxicillin)
- Patient profiles: allergies, chronic conditions, insurance provider and coverage, loyalty points, purchase and prescription history
- Printable dispensing labels

**Inventory**
- Medicine catalog with generic name, dosage form, strength, pack size, barcode, shelf location and storage conditions
- Batch / lot tracking with expiry dates; stock is dispensed **first-expiry-first-out** and expired batches are blocked from sale
- Expiry alerts, low-stock alerts, stock adjustments and write-offs (expired, damaged) with a full movement audit log
- Suppliers, purchase orders, reorder suggestions and receiving deliveries straight into batches

**Business**
- Dashboard with today's sales, profit, alerts, best sellers and payment mix
- Reports: net sales, gross profit and margin, tax collected, daily trend, busiest hours, sales by category, top medicines, staff performance, inventory valuation, write-offs — with CSV export
- Returns and refunds with optional restocking into the original batch
- Staff accounts with roles (admin, pharmacist, cashier)
- Settings: business details, **any currency** (ISO code, custom symbol, decimals, number format), tax name and rate, time zone, invoice prefix, receipt header/footer, safety rules and loyalty program
- First-run setup wizard with optional demo data

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Recharts, lucide icons |
| Backend | Node.js REST API via Next.js route handlers (`src/app/api`) |
| Database | PostgreSQL via Drizzle ORM; embedded PGlite for zero-setup local development |
| Auth | Email + password (bcrypt), HTTP-only session cookies stored in the database |

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no `DATABASE_URL`, an embedded PostgreSQL database is created in `.data/` automatically. The setup wizard walks you through pharmacy details, currency, tax and the admin account. Tick **Load demo data** to explore with sample medicines, patients, prescriptions and a month of sales.

To use your own PostgreSQL instead, copy `.env.example` to `.env.local` and set `DATABASE_URL`.

## Deploy to Vercel

1. In Vercel, **Add New → Project** and import this GitHub repository. The framework is detected as Next.js; no build settings need changing.
2. Add a database: in the project, open **Storage → Create / Connect Database** and choose **Neon** (Postgres). This sets `DATABASE_URL` / `POSTGRES_URL` for you. Any PostgreSQL works (Supabase, Railway, RDS…): just set `DATABASE_URL` under **Settings → Environment Variables**.
3. Deploy (or redeploy after adding the database). Tables are created automatically on the first request.
4. Open the site and complete the setup wizard.

> If you load demo data, two demo staff accounts are created (`pharmacist@demo.pharmacy` and `cashier@demo.pharmacy`, password `demo1234`). Deactivate them under **Staff** before going live.

## Roles

| Capability | Admin | Pharmacist | Cashier |
| --- | :-: | :-: | :-: |
| Sell, patients, own shift | ✓ | ✓ | ✓ |
| Dispense controlled drugs | ✓ | ✓ | |
| Medicines, stock, purchasing, suppliers | ✓ | ✓ | view |
| Prescriptions (create / cancel) | ✓ | ✓ | dispense |
| Returns & refunds | ✓ | ✓ | |
| Reports | ✓ | ✓ | |
| Staff & settings | ✓ | | |

## Project structure

```
src/
  app/
    (auth)/         login and setup wizard
    (app)/          the signed-in application (dashboard, POS, inventory…)
    api/            REST API (Node.js route handlers)
  components/       UI kit, app shell, POS receipt, charts, forms
  db/               Drizzle schema and connection (auto-migrates)
  lib/server/       auth, sales engine, inventory queries, seed data
drizzle/            SQL migrations
```

## Database changes

Edit `src/db/schema.ts`, then run `npm run db:generate` to create a new migration in `drizzle/`. Migrations are applied automatically when the app starts.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:studio` | Browse the database with Drizzle Studio |

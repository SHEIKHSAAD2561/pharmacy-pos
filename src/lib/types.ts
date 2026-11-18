export type Product = {
  id: number;
  name: string;
  genericName: string;
  brand: string;
  manufacturer: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  dosageForm: string;
  strength: string;
  packSize: string;
  unit: string;
  sku: string;
  barcode: string | null;
  sellPrice: number;
  costPrice: number;
  taxable: boolean;
  requiresPrescription: boolean;
  controlled: boolean;
  reorderLevel: number;
  shelfLocation: string;
  storage: string;
  description: string;
  active: boolean;
  stock: number;
  expiredStock: number;
  nextExpiry: string | null;
};

export type Category = { id: number; name: string; color: string; productCount: number };

export type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string | null;
  gender: string;
  address: string;
  allergies: string;
  chronicConditions: string;
  insuranceProvider: string;
  insuranceNumber: string;
  insuranceCoverage: number;
  loyaltyPoints: number;
  notes: string;
  createdAt: string;
  visits?: number;
  totalSpent?: number;
  lastVisit?: string | null;
};

export type Supplier = {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
  paymentTerms: string;
  notes: string;
  active: boolean;
  orderCount?: number;
  totalPurchased?: number;
};

export type Quote = {
  lines: {
    productId: number;
    name: string;
    quantity: number;
    unitPrice: number;
    gross: number;
    discount: number;
    tax: number;
    total: number;
    requiresPrescription: boolean;
    controlled: boolean;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  insuranceAmount: number;
  pointsRedeemed: number;
  pointsValue: number;
  amountDue: number;
  warnings: string[];
};

export type PrescriptionListItem = {
  id: number;
  code: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  doctorName: string;
  clinic: string;
  issueDate: string;
  diagnosis: string;
  status: "pending" | "dispensed" | "cancelled";
  saleId: number | null;
  createdAt: string;
  itemCount: number;
};

export type PrescriptionDetail = Omit<PrescriptionListItem, "customerName" | "customerPhone" | "itemCount"> & {
  doctorLicense: string;
  notes: string;
  customer: Customer;
  createdByName: string | null;
  warnings: string[];
  items: {
    id: number;
    productId: number;
    quantity: number;
    dosage: string;
    duration: string;
    instructions: string;
    productName: string;
    genericName: string;
    strength: string;
    dosageForm: string;
    sellPrice: number;
    stock: number;
  }[];
};

// --- 34 ta Sklad Kategoriyalari ---
export const SKLAD_CATEGORIES = [
  'AYU KOMPLEKT',
  'AYU UZUK',
  'AYU BALDOQ',
  'AYU BRILLIANT KOMPLEKT',
  'AYU BRILLIANT UZUK',
  'AYU BRILLIANT BALDOQ',
  'AYU KULON',
  'AYU DETSKIY BALDOQ',
  'AYU BILAKUZUK',
  'JAMSHID BILAK',
  'TURK KOMPLEKT',
  'TURK UZUK',
  'TURK BALDOQ',
  'TURK BILAK',
  'TURK TROS',
  'TURK BRASLET',
  'TURK KULON',
  'SHTAMP BRASLET',
  'KARDINAL TROS',
  'KARDINAL BRASLET',
  'MEDAS TROS',
  'MEDAS BRASLET',
  'ARCHA TROS',
  'ARCHA BRASLET',
  'BAHOR TROS',
  'BAHOR BRASLET',
  'SHTAMP TROS',
  'ZAVOD ZMEYKA TROS',
  'YEREVAN BILAK',
  'ZAVOD UZUK',
  'ZAVOD BALDOQ',
  'BILOLXON KOMPLEKT',
  'BILOLXON UZUK',
  'BILOLXON BALDOQ',
] as const;

export type SkladCategory = typeof SKLAD_CATEGORIES[number];

export type ProductType = 'Uzuk' | 'Braslet' | 'Baldoq' | 'Komplekt' | 'Bilak' | 'Tros' | 'Kulon';

export type PaymentType = 'Cash' | 'Card' | 'Nasiya' | 'Mixed' | 'CashCard' | 'CashCardNasiya';

export interface ProductPart {
  id: string;
  name: string;
  code: string;
  weight: number;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  origin: string;
  type: ProductType;
  category: SkladCategory;
  image: string; // Base64 yoki ObjectURL
  weight: number;
  costPriceUZS?: number; // Tan narxi (UZS)
  status: 'InStock' | 'Sold' | 'PartialSold';
  addedAt: string;
  parts?: ProductPart[]; // Komplekt qismlari (ixtiyoriy)
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  staffId: string;
  staffName: string;
  sellerName: string;
  costPriceUZS: number;
  soldPriceUZS: number;
  cashAmountUZS: number;     // Naqd to'langan qism (UZS)
  cardAmountUZS: number;     // Karta orqali to'langan qism (UZS)
  nasiyaAmountUZS: number;   // Nasiyaga qolgan qism (UZS)
  paymentType: PaymentType;
  date: string;
  isReturned?: boolean;
}

export interface Payment {
  id: string;
  date: string;
  amountUZS: number;
  comment?: string;
  paymentType: 'Cash' | 'Card';
}

export interface Debt {
  id: string;
  saleId: string;
  customerName: string;
  customerPhone: string;
  totalUZS: number;
  paidUZS: number;
  date: string;
  payments: Payment[];
}

export interface Expense {
  id: string;
  category: 'Ijara' | 'Oylik' | 'Soliq' | 'Kommunal' | 'Boshqa';
  description: string;
  amountUZS: number;
  date: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  pin: string;
  role: 'Manager' | 'Staff';
  dailySales: number;
  monthlySales: number;
}

export interface Investor {
  id: string;
  name: string;
  currency: 'Oltin' | 'USD' | 'UZS';
  amount: number; // Oltin bo'lsa gramm, USD yoki UZS bo'lsa summa
  date: string;
}

export interface GoldRateEntry {
  rate: number; // UZS per gram
  date: string;
}

export interface Shift {
  id: string;
  date: string;
  closedBy: string;
  totalSalesUZS: number;
  totalCashUZS: number;
  totalCardUZS: number;
  totalNasiyaUZS: number;
  totalExpensesUZS: number;
}

export interface InboundMoney {
  id: string;
  fromWho: string; // Kimdan
  source: string;  // Qayerdan
  amountUZS: number;
  date: string;
}

export interface AppSettings {
  shopName: string;
  phone: string;
  address: string;
}

export interface AppData {
  products: Product[];
  sales: Sale[];
  debts: Debt[];
  users: User[];
  investors: Investor[];
  expenses: Expense[];
  shifts: Shift[];
  goldRateUZS: number;       // 1g oltin = ? so'm
  exchangeRateUZS: number;   // 1 USD = ? so'm
  goldRateHistory: GoldRateEntry[];
  inboundMoney: InboundMoney[];
  settings: AppSettings;
}

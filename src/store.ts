import { AppData, Product, Sale, Debt, User, Investor, Expense, Payment, Shift, SKLAD_CATEGORIES } from './types';
import { sendTelegramMessage } from './telegram';

const STORAGE_KEY = 'hadiya_gold_data';

const DEFAULT_DATA: AppData = {
  products: [],
  sales: [],
  debts: [],
  users: [
    { id: '1', name: 'Menejer', phone: '+998901234567', pin: '4567', role: 'Manager' as const, dailySales: 0, monthlySales: 0 },
    { id: '2', name: 'Sotuvchi 1', phone: '+998001112233', pin: '1111', role: 'Staff' as const, dailySales: 0, monthlySales: 0 }
  ],
  investors: [],
  expenses: [],
  shifts: [],
  goldRateUZS: 850000,       // 1 gramm oltin = 850,000 so'm
  exchangeRateUZS: 12800,    // 1 USD = 12,800 so'm
  goldRateHistory: [
    { rate: 850000, date: new Date().toISOString() }
  ],
  settings: {
    shopName: 'Hadiya Gold',
    phone: '+998 00 000 00 00',
    address: 'Toshkent sh., Chorsu'
  }
};

export const loadData = (): AppData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const exRate = parsed.exchangeRateUZS || 12800;

      return {
        ...DEFAULT_DATA,
        ...parsed,
        products: (parsed.products || []).map((p: any) => ({
          ...p,
          category: p.category || SKLAD_CATEGORIES[0],
          image: p.image || '',
          // Migrate: eski costPriceUSD -> costPriceUZS
          costPriceUZS: p.costPriceUZS ?? (p.costPriceUSD ? p.costPriceUSD * exRate : undefined),
          status: p.status || 'InStock',
          parts: p.parts || [],
        })),
        sales: (parsed.sales || []).map((s: any) => ({
          ...s,
          sellerName: s.sellerName || s.staffName || '',
          // Migrate $->UZS
          soldPriceUZS: s.soldPriceUZS ?? (s.soldPriceUSD ? s.soldPriceUSD * exRate : 0),
          costPriceUZS: s.costPriceUZS ?? (s.costPriceUSD ? s.costPriceUSD * exRate : 0),
          cashAmountUZS: s.cashAmountUZS ?? (s.cashAmountUSD ? s.cashAmountUSD * exRate : 0),
          cardAmountUZS: s.cardAmountUZS ?? 0,
          nasiyaAmountUZS: s.nasiyaAmountUZS ?? (s.nasiyaAmountUSD ? s.nasiyaAmountUSD * exRate : 0),
          paymentType: s.paymentType || 'Cash',
        })),
        debts: (parsed.debts || []).map((d: any) => ({
          ...d,
          totalUZS: d.totalUZS ?? (d.totalUSD ? d.totalUSD * exRate : 0),
          paidUZS: d.paidUZS ?? (d.paidUSD ? d.paidUSD * exRate : 0),
          payments: (d.payments || []).map((pay: any) => ({
            ...pay,
            amountUZS: pay.amountUZS ?? (pay.amountUSD ? pay.amountUSD * exRate : 0),
            paymentType: pay.paymentType || 'Cash',
          }))
        })),
        users: (parsed.users || []).map((u: any) => {
          const defaultUser = DEFAULT_DATA.users.find(du => du.id === u.id);
          let name = u.name;
          if (name === 'Manager (Admin)' || name === 'Admin') name = 'Menejer';
          return { ...u, name, phone: u.phone || defaultUser?.phone || '', pin: u.pin || defaultUser?.pin || '' };
        }),
        investors: (parsed.investors || []).map((inv: any) => ({
          id: inv.id,
          name: inv.name,
          date: inv.date,
          // Migrate eski format
          currency: inv.currency || 'USD',
          amount: inv.amount ?? inv.goldGrams ?? inv.amountUSD ?? 0,
        })),
        expenses: (parsed.expenses || []).map((ex: any) => ({
          ...ex,
          amountUZS: ex.amountUZS ?? (ex.amountUSD ? ex.amountUSD * exRate : 0),
        })),
        shifts: parsed.shifts || [],
        goldRateUZS: parsed.goldRateUZS || (parsed.goldRateUSD ? parsed.goldRateUSD * exRate : DEFAULT_DATA.goldRateUZS),
        goldRateHistory: parsed.goldRateHistory || [{ rate: DEFAULT_DATA.goldRateUZS, date: new Date().toISOString() }],
        exchangeRateUZS: exRate,
        settings: parsed.settings || DEFAULT_DATA.settings,
      };
    } catch (e) {
      console.error('Failed to load data', e);
    }
  }
  return DEFAULT_DATA;
};

export const saveData = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const addProduct = (product: Product) => {
  const data = loadData();
  data.products.push(product);
  saveData(data);
};

export const sellProduct = (sale: Sale, buyerDebt?: Debt) => {
  const data = loadData();
  data.sales.push(sale);
  const product = data.products.find(p => p.id === sale.productId);
  if (product) {
    product.status = 'Sold';
    // Ombor ogohlantirishlari
    const categoryCount = data.products.filter(p => p.category === product.category && (p.status === 'InStock' || p.status === 'PartialSold')).length;
    if (categoryCount <= 3) {
      sendTelegramMessage(`⚠️ <b>OMBOR OGOHLANTIRISHI:</b>\n\n"<a href="none">${product.category}</a>" kategoriyasidan atigi <b>${categoryCount} ta</b> mahsulot qoldi.\nSotilgan mahsulot: ${product.name}\nUshbu mahsulot turidan tez orada olib kelinishi maqsadga muvofiq.`);
    }
  }
  if (buyerDebt && (sale.paymentType === 'Nasiya' || sale.paymentType === 'Mixed' || sale.paymentType === 'CashCardNasiya')) {
    data.debts.push({ ...buyerDebt, payments: [] });
  }
  const staff = data.users.find(u => u.id === sale.staffId);
  if (staff) {
    staff.dailySales += 1;
    staff.monthlySales += 1;
  }
  saveData(data);
};

export const addPaymentToDebt = (debtId: string, payment: Payment) => {
  const data = loadData();
  const debt = data.debts.find(d => d.id === debtId);
  if (debt) {
    debt.payments.push(payment);
    debt.paidUZS += payment.amountUZS;
    saveData(data);
  }
};

export const addExpense = (expense: Expense) => {
  const data = loadData();
  data.expenses.push(expense);
  saveData(data);
};

export const addInvestor = (investor: Investor) => {
  const data = loadData();
  data.investors.push(investor);
  saveData(data);
};

export const addUser = (user: User) => {
  const data = loadData();
  data.users.push(user);
  saveData(data);
};

export const mergeRemoteData = (remote: Partial<AppData>) => {
  const local = loadData();
  const merged: AppData = {
    ...local,
    users: remote.users && remote.users.length >= local.users.length ? remote.users : local.users,
    debts: remote.debts && remote.debts.length >= local.debts.length ? remote.debts : local.debts,
    sales: remote.sales && remote.sales.length >= local.sales.length ? remote.sales : local.sales,
    products: remote.products && remote.products.length >= local.products.length ? remote.products : local.products,
    goldRateUZS: remote.goldRateUZS || local.goldRateUZS,
  };
  saveData(merged);
};

export const updateUser = (id: string, updated: Partial<User>) => {
  const data = loadData();
  const index = data.users.findIndex(u => u.id === id);
  if (index !== -1) {
    data.users[index] = { ...data.users[index], ...updated };
    saveData(data);
  }
};

export const deleteUser = (id: string) => {
  const data = loadData();
  data.users = data.users.filter(u => u.id !== id);
  saveData(data);
};

export const updateGoldRate = (rateUZS: number) => {
  const data = loadData();
  data.goldRateUZS = rateUZS;
  data.goldRateHistory.push({ rate: rateUZS, date: new Date().toISOString() });
  saveData(data);
};

export const updateExchangeRate = (rate: number) => {
  const data = loadData();
  data.exchangeRateUZS = rate;
  saveData(data);
};

export const updateSettings = (settings: AppData['settings']) => {
  const data = loadData();
  data.settings = settings;
  saveData(data);
};

export const saveShift = (shift: Shift) => {
  const data = loadData();
  data.shifts.push(shift);
  saveData(data);
};

export const exportData = () => {
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hadiya_gold_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
};

export const importData = (jsonData: string) => {
  try {
    const data = JSON.parse(jsonData);
    saveData(data);
    return true;
  } catch (e) {
    console.error('Import failed', e);
    return false;
  }
};

export const updateProduct = (id: string, updated: Partial<Product>) => {
  const data = loadData();
  const index = data.products.findIndex(p => p.id === id);
  if (index !== -1) {
    data.products[index] = { ...data.products[index], ...updated };
    saveData(data);
  }
};

export const deleteProduct = (id: string) => {
  const data = loadData();
  data.products = data.products.filter(p => p.id !== id);
  saveData(data);
};

// Format UZS
export const fmtUZS = (amount: number): string => {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + ' so\'m';
};

// Toshkent vaqti (UTC+5) bo'yicha YYYY-MM-DD sanasini qaytaradi
export const getLocalDate = (isoStr?: string): string => {
  const d = isoStr ? new Date(isoStr) : new Date();
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' });
};

// Toshkent vaqtida format qilib chiqarish
export const fmtLocalDateTime = (isoStr: string): string => {
  return new Date(isoStr).toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

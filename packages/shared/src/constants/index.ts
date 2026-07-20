/** Mirrors Prisma enums — the string values MUST stay in sync with prisma/schema.prisma. */

export const TRANSACTION_TYPES = [
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "INVESTMENT",
  "LOAN",
  "DEBT",
  "SAVING",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const ACCOUNT_TYPES = [
  "CASH",
  "BANK",
  "CREDIT_CARD",
  "EWALLET",
  "CRYPTO_WALLET",
  "INVESTMENT",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const BUDGET_PERIODS = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

export const INVESTMENT_TYPES = [
  "STOCK",
  "ETF",
  "MUTUAL_FUND",
  "CRYPTO",
  "GOLD",
  "OTHER",
] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

/** System categories seeded for every install. `key` is stable; names are display-only. */
export const SYSTEM_CATEGORIES = [
  { key: "food", name: "Food", nameTh: "อาหาร", icon: "🍚", kind: "EXPENSE" },
  { key: "transport", name: "Transportation", nameTh: "เดินทาง", icon: "🚌", kind: "EXPENSE" },
  { key: "shopping", name: "Shopping", nameTh: "ช้อปปิ้ง", icon: "🛍️", kind: "EXPENSE" },
  { key: "bills", name: "Bills", nameTh: "บิล/ค่าน้ำค่าไฟ", icon: "🧾", kind: "EXPENSE" },
  { key: "health", name: "Health", nameTh: "สุขภาพ", icon: "💊", kind: "EXPENSE" },
  { key: "education", name: "Education", nameTh: "การศึกษา", icon: "📚", kind: "EXPENSE" },
  { key: "travel", name: "Travel", nameTh: "ท่องเที่ยว", icon: "✈️", kind: "EXPENSE" },
  { key: "entertainment", name: "Entertainment", nameTh: "บันเทิง", icon: "🎬", kind: "EXPENSE" },
  { key: "investment", name: "Investment", nameTh: "ลงทุน", icon: "📈", kind: "BOTH" },
  { key: "insurance", name: "Insurance", nameTh: "ประกัน", icon: "🛡️", kind: "EXPENSE" },
  { key: "tax", name: "Tax", nameTh: "ภาษี", icon: "🏛️", kind: "EXPENSE" },
  { key: "gift", name: "Gift", nameTh: "ของขวัญ", icon: "🎁", kind: "BOTH" },
  { key: "salary", name: "Salary", nameTh: "เงินเดือน", icon: "💰", kind: "INCOME" },
  { key: "business", name: "Business", nameTh: "ธุรกิจ", icon: "💼", kind: "BOTH" },
  { key: "others", name: "Others", nameTh: "อื่นๆ", icon: "📦", kind: "BOTH" },
] as const;
export type SystemCategoryKey = (typeof SYSTEM_CATEGORIES)[number]["key"];

/** Thai bank / e-wallet providers for Account presets. */
export const BANK_PROVIDERS = [
  { key: "cash", name: "Cash", nameTh: "เงินสด", color: "#6B7280" },
  { key: "scb", name: "SCB", nameTh: "ไทยพาณิชย์", color: "#4E2A84" },
  { key: "kbank", name: "KBank", nameTh: "กสิกรไทย", color: "#00A950" },
  { key: "ktb", name: "Krungthai", nameTh: "กรุงไทย", color: "#00A6E6" },
  { key: "bbl", name: "Bangkok Bank", nameTh: "กรุงเทพ", color: "#1E4598" },
  { key: "truemoney", name: "TrueMoney", nameTh: "ทรูมันนี่", color: "#F58220" },
] as const;
export type BankProviderKey = (typeof BANK_PROVIDERS)[number]["key"];

export const DEFAULT_TIMEZONE = "Asia/Bangkok";
export const DEFAULT_CURRENCY = "THB";
export const DEFAULT_LANGUAGE = "th";
export const BUDGET_ALERT_LEVELS = [50, 80, 100] as const;

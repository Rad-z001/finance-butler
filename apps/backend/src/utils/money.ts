import { Prisma } from "@prisma/client";

export type Dec = Prisma.Decimal;
export const Dec = Prisma.Decimal;

const thb = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** "1200.5" → "1,200.50฿"-style display without the sign/symbol. */
export function formatAmount(value: Prisma.Decimal | string | number): string {
  const d = new Prisma.Decimal(value);
  return thb.format(d.toNumber()); // display only — never used for arithmetic
}

export function formatSigned(value: Prisma.Decimal | string, type: string): string {
  const isIn = type === "INCOME";
  return `${isIn ? "+" : "−"}${formatAmount(value)}฿`;
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: 'MD' | 'KES' = 'MD') {
  if (currency === 'MD') {
    return `${amount.toLocaleString()} MD`;
  }
  return `KES ${amount.toLocaleString()}`;
}

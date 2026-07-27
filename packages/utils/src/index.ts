export const CURRENCY_SYMBOL = "৳";

export function formatCurrency(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString()}`;
}

export function fn() {
  return "Hello, tsdown!";
}

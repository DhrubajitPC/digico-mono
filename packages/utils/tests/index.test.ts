import { expect, test } from "vite-plus/test";
import { CURRENCY_SYMBOL, formatCurrency, formatTime, truncate } from "../src/index.ts";

test("CURRENCY_SYMBOL", () => {
  expect(CURRENCY_SYMBOL).toBe("৳");
});

test("formatCurrency", () => {
  expect(formatCurrency(1234)).toBe("৳1,234");
  expect(formatCurrency(0)).toBe("৳0");
});

test("formatTime", () => {
  const out = formatTime("2026-08-14T10:30:00Z");
  expect(typeof out).toBe("string");
  expect(out).toContain("14");
  expect(out).toMatch(/:\d{2}/);
});

test("truncate", () => {
  expect(truncate(null)).toBe("—");
  expect(truncate("")).toBe("—");
  expect(truncate("short text")).toBe("short text");
  expect(truncate("a".repeat(100), 70)).toBe(`${"a".repeat(69)}…`);
});

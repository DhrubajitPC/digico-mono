import { expect, test } from "vite-plus/test";
import { mapDigicoStatusToWc, mapWcStatusToDigico, normalizePhone } from "../src/orders.ts";

// The bug this guards: dealer identity is now keyed on phone (see dealers.ts),
// but the same real number shows up in at least three raw shapes across this
// codebase — local "01...", "+880..." from the emulator, and "880..." from
// WhatsApp's wa_id. Without normalization those three collapse back into
// separate "dealers" for one real person, reproducing the bug this fixed.
test("normalizes a local 01-prefixed number to the 880 form", () => {
  expect(normalizePhone("01711000001")).toBe("8801711000001");
});

test("strips a leading + from an already-880-prefixed number", () => {
  expect(normalizePhone("+8801711000001")).toBe("8801711000001");
});

test("leaves an already-normalized 880 number unchanged", () => {
  expect(normalizePhone("8801711000001")).toBe("8801711000001");
});

test("strips spaces and dashes before normalizing", () => {
  expect(normalizePhone("+880 171-100-0001")).toBe("8801711000001");
  expect(normalizePhone("01711-000001")).toBe("8801711000001");
});

test("falls back to digits-only for a shape it doesn't recognize, rather than throwing", () => {
  expect(normalizePhone("12345")).toBe("12345");
});

test("maps WooCommerce status strings to Digico status strings", () => {
  expect(mapWcStatusToDigico("wc-pending")).toBe("pending_review");
  expect(mapWcStatusToDigico("wc-processing")).toBe("processing");
  expect(mapWcStatusToDigico("wc-on-hold")).toBe("on_hold");
  expect(mapWcStatusToDigico("wc-completed")).toBe("completed");
  expect(mapWcStatusToDigico("wc-confirmed")).toBe("confirmed");
  expect(mapWcStatusToDigico("wc-cancelled")).toBe("cancelled");
});

test("maps Digico status strings to WooCommerce status strings", () => {
  expect(mapDigicoStatusToWc("pending_review")).toBe("wc-pending");
  expect(mapDigicoStatusToWc("processing")).toBe("wc-processing");
  expect(mapDigicoStatusToWc("on_hold")).toBe("wc-on-hold");
  expect(mapDigicoStatusToWc("confirmed")).toBe("wc-confirmed");
  expect(mapDigicoStatusToWc("completed")).toBe("wc-completed");
  expect(mapDigicoStatusToWc("cancelled")).toBe("wc-cancelled");
});

test("confirmed and completed round-trip as distinct statuses", () => {
  expect(mapWcStatusToDigico(mapDigicoStatusToWc("confirmed"))).toBe("confirmed");
  expect(mapWcStatusToDigico(mapDigicoStatusToWc("completed"))).toBe("completed");
});

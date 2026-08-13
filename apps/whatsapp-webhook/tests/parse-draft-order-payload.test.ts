import { expect, test } from "vite-plus/test";
import { parseDraftOrderPayload } from "../src/services/order-tools.ts";

test("parses a valid tool-call arguments string", () => {
  const payload = parseDraftOrderPayload(
    '{"productName":"HP 15s","quantity":3,"unitPrice":68500,"totalAmount":205500}',
  );
  expect(payload).toEqual({
    productName: "HP 15s",
    quantity: 3,
    unitPrice: 68500,
    totalAmount: 205500,
  });
});

test("parses numeric strings and optional fields", () => {
  const payload = parseDraftOrderPayload({
    productName: "Monitor",
    quantity: "4",
    unitPrice: "12095",
    totalAmount: 48380,
    sku: "MON-24",
    customerName: "Souhardo Ahmed",
    phone: "+8801711000001",
    userConfirmation: true,
  });
  expect(payload).toEqual({
    productName: "Monitor",
    quantity: 4,
    unitPrice: 12095,
    totalAmount: 48380,
    sku: "MON-24",
    customerName: "Souhardo Ahmed",
    phone: "+8801711000001",
    userConfirmation: true,
  });
});

test("rejects malformed JSON", () => {
  expect(parseDraftOrderPayload("{not json")).toBeNull();
});

test("rejects non-object input", () => {
  expect(parseDraftOrderPayload(null)).toBeNull();
  expect(parseDraftOrderPayload(42)).toBeNull();
  expect(parseDraftOrderPayload([1, 2, 3])).toBeNull();
});

test("rejects missing productName", () => {
  expect(parseDraftOrderPayload('{"quantity":3,"unitPrice":100,"totalAmount":300}')).toBeNull();
});

test("rejects blank productName", () => {
  expect(
    parseDraftOrderPayload('{"productName":"  ","quantity":3,"unitPrice":100,"totalAmount":300}'),
  ).toBeNull();
});

test("rejects missing or non-positive quantity", () => {
  expect(
    parseDraftOrderPayload('{"productName":"X","unitPrice":100,"totalAmount":300}'),
  ).toBeNull();
  expect(
    parseDraftOrderPayload('{"productName":"X","quantity":0,"unitPrice":100,"totalAmount":300}'),
  ).toBeNull();
});

test("rejects non-numeric unitPrice or totalAmount", () => {
  expect(
    parseDraftOrderPayload('{"productName":"X","quantity":1,"unitPrice":"free","totalAmount":0}'),
  ).toBeNull();
  expect(
    parseDraftOrderPayload('{"productName":"X","quantity":1,"unitPrice":100,"totalAmount":null}'),
  ).toBeNull();
});

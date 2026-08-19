import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

const client = vi.hoisted(() => ({ getMariaDbPool: vi.fn() }));
vi.mock("../src/client.ts", () => client);

import {
  clearSearchCatalogCache,
  fetchMariaDbProducts,
  searchMariaDbProducts,
} from "../src/products.ts";

const originalTtl = process.env.CATALOG_CACHE_TTL_MS;

/** One published product row as the postmeta join returns it. */
function row(id: number, name: string) {
  return { id, name, sku: `SKU-${id}`, price: "1500", stock: "10" };
}

let query: ReturnType<typeof vi.fn>;

beforeEach(() => {
  query = vi.fn().mockResolvedValue([[row(1, "Conion Refrigerator"), row(2, "Baseus Cable")]]);
  client.getMariaDbPool.mockReturnValue({ query });
  clearSearchCatalogCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  clearSearchCatalogCache();
  if (originalTtl === undefined) delete process.env.CATALOG_CACHE_TTL_MS;
  else process.env.CATALOG_CACHE_TTL_MS = originalTtl;
});

// The bug this guards: LIMIT 200 hid 49 of 65 brands from retrieval, and hid them
// from the order guardrail, which then priced orders from LLM-invented numbers.
test("reads the catalog without a row cap", async () => {
  await fetchMariaDbProducts();

  const sql = String(query.mock.calls[0]![0]);
  expect(sql).not.toMatch(/LIMIT/i);
  expect(sql).toMatch(/ORDER BY p\.ID/);
  // Collapses WooCommerce duplicate postmeta rows.
  expect(sql).toMatch(/GROUP BY/);
});

test("serves retrieval from one query across repeated messages", async () => {
  process.env.CATALOG_CACHE_TTL_MS = "60000";

  await searchMariaDbProducts("Conion refrigerator");
  await searchMariaDbProducts("Baseus cable");
  await searchMariaDbProducts("Conion refrigerator");

  expect(query).toHaveBeenCalledTimes(1);
});

test("refetches once the TTL has elapsed", async () => {
  process.env.CATALOG_CACHE_TTL_MS = "0";

  await searchMariaDbProducts("Conion");
  await searchMariaDbProducts("Conion");

  expect(query).toHaveBeenCalledTimes(2);
});

test("shares a single query across concurrent messages", async () => {
  process.env.CATALOG_CACHE_TTL_MS = "60000";

  await Promise.all([
    searchMariaDbProducts("Conion"),
    searchMariaDbProducts("Baseus"),
    searchMariaDbProducts("Philips"),
  ]);

  expect(query).toHaveBeenCalledTimes(1);
});

// order-tools verifies price and stock against this call; a cached snapshot there
// would let a stale price be written into a real order.
test("leaves the live read uncached", async () => {
  process.env.CATALOG_CACHE_TTL_MS = "60000";

  await fetchMariaDbProducts();
  await fetchMariaDbProducts();

  expect(query).toHaveBeenCalledTimes(2);
});

test("retrieval can still match a product the old LIMIT would have hidden", async () => {
  const results = await searchMariaDbProducts("Baseus cable");
  expect(results.map((p) => p.name)).toContain("Baseus Cable");
});

test("clearing the cache forces a refresh", async () => {
  process.env.CATALOG_CACHE_TTL_MS = "60000";

  await searchMariaDbProducts("Conion");
  clearSearchCatalogCache();
  await searchMariaDbProducts("Conion");

  expect(query).toHaveBeenCalledTimes(2);
});

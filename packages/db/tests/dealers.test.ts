import { beforeEach, expect, test, vi } from "vite-plus/test";

const client = vi.hoisted(() => ({ getMariaDbPool: vi.fn() }));
vi.mock("../src/client.ts", () => client);

import { fetchMariaDbDealers } from "../src/dealers.ts";

let query: ReturnType<typeof vi.fn>;

beforeEach(() => {
  query = vi.fn();
  client.getMariaDbPool.mockReturnValue({ query });
});

/** One shop_order row as joy_posts returns it. */
function orderRow(id: number) {
  return {
    id,
    created_at: "2026-08-01 10:00:00",
    updated_at: "2026-08-01 10:00:00",
    status: "wc-processing",
    customer_note: null,
  };
}

function metaRow(postId: number, key: string, value: string) {
  return { post_id: postId, meta_key: key, meta_value: value };
}

// The bug this guards: dealer identity was keyed off _customer_user, which falls
// back to the order's own row ID whenever that meta is absent or "0" — the norm
// for every WhatsApp/manual order, since none of them are placed by a logged-in
// WooCommerce account. The same phone number then produced one "dealer" entry
// per order instead of one entry per real person.
test("collapses multiple guest-checkout orders from the same phone into one dealer", async () => {
  query.mockResolvedValueOnce([[orderRow(101), orderRow(102), orderRow(103)]]);
  query.mockResolvedValueOnce([
    [
      metaRow(101, "_billing_phone", "01777898395"),
      metaRow(101, "_billing_first_name", "Mehedi Hasan"),
      metaRow(102, "_billing_phone", "01777898395"),
      metaRow(102, "_billing_first_name", "Mehedi Hasan"),
      metaRow(103, "_billing_phone", "01777898395"),
      metaRow(103, "_billing_first_name", "Mehedi Hasan"),
    ],
  ]);
  query.mockResolvedValueOnce([[]]);

  const dealers = await fetchMariaDbDealers();

  const mehedi = dealers.filter((d) => d.phone === "01777898395");
  expect(mehedi).toHaveLength(1);
});

// A real WooCommerce login (_customer_user set and consistent) already collapsed
// correctly under the old id-based dedupe; the phone-based dedupe must not
// regress that case into merging two different phones that happen to share a
// customer_user value in messy data, or splitting one phone into two entries.
test("still returns one dealer per distinct phone", async () => {
  query.mockResolvedValueOnce([[orderRow(201), orderRow(202)]]);
  query.mockResolvedValueOnce([
    [
      metaRow(201, "_billing_phone", "01711111111"),
      metaRow(201, "_billing_first_name", "Alice"),
      metaRow(202, "_billing_phone", "01722222222"),
      metaRow(202, "_billing_first_name", "Bob"),
    ],
  ]);
  query.mockResolvedValueOnce([[]]);

  const dealers = await fetchMariaDbDealers();

  expect(dealers.map((d) => d.phone).sort()).toEqual(["01711111111", "01722222222"]);
});

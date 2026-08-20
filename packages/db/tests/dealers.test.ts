import { beforeEach, expect, test, vi } from "vite-plus/test";

const client = vi.hoisted(() => ({ getMariaDbPool: vi.fn() }));
vi.mock("../src/client.ts", () => client);

import { fetchMariaDbDealerByPhone, fetchMariaDbDealers } from "../src/dealers.ts";

let query: ReturnType<typeof vi.fn>;

beforeEach(() => {
  query = vi.fn();
  client.getMariaDbPool.mockReturnValue({ query });
});

/** One shop_order row as joy_posts returns it. */
function orderRow(id: number, createdAt: string) {
  return {
    id,
    created_at: createdAt,
    updated_at: createdAt,
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
test("collapses multiple guest-checkout orders from the same phone into one dealer, keeping the most recent order's info", async () => {
  // fetchMariaDbOrders sorts ORDER BY post_date DESC, so the query already
  // returns the most recent order (103) first — the mock mirrors that.
  query.mockResolvedValueOnce([
    [
      orderRow(103, "2026-08-03 10:00:00"),
      orderRow(102, "2026-08-02 10:00:00"),
      orderRow(101, "2026-08-01 10:00:00"),
    ],
  ]);
  query.mockResolvedValueOnce([
    [
      metaRow(101, "_billing_phone", "01777898395"),
      metaRow(101, "_billing_first_name", "Mehedi Hasan (order 1)"),
      metaRow(102, "_billing_phone", "01777898395"),
      metaRow(102, "_billing_first_name", "Mehedi Hasan (order 2)"),
      metaRow(103, "_billing_phone", "01777898395"),
      metaRow(103, "_billing_first_name", "Mehedi Hasan (order 3, latest)"),
    ],
  ]);
  query.mockResolvedValueOnce([[]]);

  const dealers = await fetchMariaDbDealers();

  const mehedi = dealers.filter((d) => d.phone === "8801777898395");
  expect(mehedi).toHaveLength(1);
  // Must reflect the most recent order (103), not just any of the three.
  expect(mehedi[0]?.contactPerson).toBe("Mehedi Hasan (order 3, latest)");
});

// A real WooCommerce login (_customer_user set and consistent) already collapsed
// correctly under the old id-based dedupe; the phone-based dedupe must not
// regress that case into merging two different phones that happen to share a
// customer_user value in messy data, or splitting one phone into two entries.
test("still returns one dealer per distinct phone", async () => {
  query.mockResolvedValueOnce([
    [orderRow(201, "2026-08-01 10:00:00"), orderRow(202, "2026-08-01 11:00:00")],
  ]);
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

  expect(dealers.map((d) => d.phone).sort()).toEqual(["8801711111111", "8801722222222"]);
});

// The bug this guards: orders.ts falls back to a shared placeholder phone
// ("+8801700000000") whenever an order has no real billing phone — the norm
// for a WhatsApp order where the LLM didn't extract one. Once dealer identity
// is keyed on phone, two orders sharing that placeholder would otherwise merge
// into one bogus "dealer", misattributing a follow-up order to a stranger.
test("excludes orders with the shared unknown-phone placeholder from the dealers list", async () => {
  query.mockResolvedValueOnce([
    [orderRow(301, "2026-08-01 10:00:00"), orderRow(302, "2026-08-02 10:00:00")],
  ]);
  query.mockResolvedValueOnce([
    [
      metaRow(301, "_billing_first_name", "Stranger A"),
      // 301 has no _billing_phone meta at all -> falls back to the placeholder.
      metaRow(302, "_billing_phone", "01733333333"),
      metaRow(302, "_billing_first_name", "Real Dealer"),
    ],
  ]);
  query.mockResolvedValueOnce([[]]);

  const dealers = await fetchMariaDbDealers();

  expect(dealers).toHaveLength(1);
  expect(dealers[0]?.phone).toBe("8801733333333");
});

test("fetchMariaDbDealerByPhone matches regardless of the query phone's formatting", async () => {
  query.mockResolvedValueOnce([
    [{ id: 501, phone: "01744444444", created_at: "2026-08-01 10:00:00" }],
  ]);
  query.mockResolvedValueOnce([
    [
      {
        id: 501,
        created_at: "2026-08-01 10:00:00",
        updated_at: "2026-08-01 10:00:00",
        status: "wc-processing",
        customer_note: null,
      },
    ],
  ]);
  query.mockResolvedValueOnce([
    [metaRow(501, "_billing_phone", "01744444444"), metaRow(501, "_billing_first_name", "Karim")],
  ]);
  query.mockResolvedValueOnce([[]]);

  const dealer = await fetchMariaDbDealerByPhone("+880 1744-444444");

  expect(dealer?.phone).toBe("8801744444444");
  expect(dealer?.contactPerson).toBe("Karim");
});

test("fetchMariaDbDealerByPhone returns null for the unknown-phone placeholder", async () => {
  const dealer = await fetchMariaDbDealerByPhone("+8801700000000");
  expect(dealer).toBeNull();
  expect(query).not.toHaveBeenCalled();
});

test("fetchMariaDbDealerByPhone returns null when no order matches", async () => {
  query.mockResolvedValueOnce([
    [{ id: 601, phone: "01755555555", created_at: "2026-08-01 10:00:00" }],
  ]);

  const dealer = await fetchMariaDbDealerByPhone("01799999999");

  expect(dealer).toBeNull();
});

// The bug this guards: fetchMariaDbDealers() (and the old id-based lookup it
// fed) was implicitly bounded by fetchMariaDbOrders' LIMIT 200, so a dealer
// whose most recent order aged out of the 200 most-recent orders overall
// silently failed lookup. The targeted query must not carry that cap.
test("fetchMariaDbDealerByPhone's query has no LIMIT", async () => {
  query.mockResolvedValueOnce([[]]);

  await fetchMariaDbDealerByPhone("01766666666");

  const sql = String(query.mock.calls[0]![0]);
  expect(sql).not.toMatch(/LIMIT/i);
});

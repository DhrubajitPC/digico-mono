### Task 4: Client foundation + hooks migration

**Files:**

- Create: `apps/website/src/trpc.ts`
- Modify: `apps/website/src/main.tsx`
- Rewrite: `apps/website/src/hooks/useOrders.ts`
- Rewrite: `apps/website/src/hooks/useOrderReview.ts`

**Interfaces:**

- Consumes: `trpc` client instance (this task), `trpc.orders.list/get/update/setStatus/bulkSetStatus/create`, `trpc.products.list` (from Task 2/3), `@digico/contracts` types.
- Produces: the same return surfaces `useOrders`/`useOrderReview` expose today — `OrdersDashboard.tsx` and `OrderReviewDrawer.tsx` are **not** touched in this task.

- [ ] **Step 1: Create the tRPC client**

`apps/website/src/trpc.ts`:

```ts
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@digico/api";

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/trpc" })],
});
```

- [ ] **Step 2: Wire the providers in `main.tsx`**

Replace `apps/website/src/main.tsx` with:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.js";
import { trpc, trpcClient } from "./trpc.js";
import "./theme.css";
import "./style.css";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
```

- [ ] **Step 3: Rewrite `useOrders`**

Replace `apps/website/src/hooks/useOrders.ts` with:

```ts
import { useState, type ChangeEvent } from "react";
import { trpc } from "../trpc.js";
import type { Order } from "@digico/contracts";

const BULK_ACTION_STATUS: Record<string, Order["status"] | null> = {
  processing: "processing",
  on_hold: "on_hold",
  completed: "completed",
  cancelled: "cancelled",
};

/** Fetch state, tab/search/origin filters, row selection, and bulk actions for the orders dashboard. */
export function useOrders() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const ordersQuery = trpc.orders.list.useQuery({
    status: activeTab,
    origin: originFilter || undefined,
    search: searchQuery || undefined,
  });

  const bulkStatusMutation = trpc.orders.bulkSetStatus.useMutation({
    onSuccess: () => void utils.orders.list.invalidate(),
  });

  const fetchOrders = () => {
    void utils.orders.list.invalidate();
  };

  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && ordersQuery.data) {
      setSelectedOrderIds(ordersQuery.data.items.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleToggleSelectOrder = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleApplyBulkAction = async () => {
    if (!bulkAction || selectedOrderIds.length === 0) return;
    const targetStatus = BULK_ACTION_STATUS[bulkAction];
    if (!targetStatus) return;
    await bulkStatusMutation.mutateAsync({
      orderIds: selectedOrderIds,
      status: targetStatus,
      reason: `Bulk action: ${bulkAction}`,
    });
    setSelectedOrderIds([]);
    setBulkAction("");
  };

  return {
    ordersData: ordersQuery.data ?? null,
    activeTab,
    searchQuery,
    originFilter,
    selectedOrderIds,
    bulkAction,
    isLoading: ordersQuery.isFetching,
    reviewOrderId,
    showCreateModal,
    setActiveTab,
    setSearchQuery,
    setOriginFilter,
    setBulkAction,
    setSelectedOrderIds,
    setReviewOrderId,
    setShowCreateModal,
    fetchOrders,
    handleSelectAll,
    handleToggleSelectOrder,
    handleApplyBulkAction,
    counts: ordersQuery.data?.counts ?? {},
  };
}
```

Notes: `isLoading: ordersQuery.isFetching` matches today's spinner-on-every-fetch semantics; `fetchOrders` is now a query-key invalidation (the dashboard's refresh button + drawer `onRefresh` both still call it unchanged).

- [ ] **Step 4: Rewrite `useOrderReview`**

Replace `apps/website/src/hooks/useOrderReview.ts` with:

```ts
import { useEffect, useState } from "react";
import { trpc } from "../trpc.js";
import type { Order, OrderItem } from "@digico/contracts";
import { formatCurrency } from "@digico/utils";

/** Order + product loading, editable line items, message/notes, and the five mutation handlers. */
export function useOrderReview(
  orderId: number | null,
  options: { onRefresh: () => void; onClose: () => void },
) {
  const utils = trpc.useUtils();
  const [editableItems, setEditableItems] = useState<OrderItem[]>([]);
  const [proposedMsg, setProposedMsg] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");

  const orderQuery = trpc.orders.get.useQuery({ id: orderId ?? 0 }, { enabled: orderId !== null });
  const productsQuery = trpc.products.list.useQuery();
  const order = orderQuery.data ?? null;
  const productsList = productsQuery.data ?? [];

  // Sync local editable state whenever the order (re)loads — same behavior as the old loadData().
  useEffect(() => {
    if (!order) return;
    setEditableItems(order.items.map((i) => ({ ...i })));
    setProposedMsg(
      order.proposedMessage ??
        `Dear ${order.dealer.businessName}, your order ${order.orderNumber} for total ${formatCurrency(order.totalAmount)} has been confirmed.`,
    );
    setNotes(order.notes ?? "");
  }, [order]);

  useEffect(() => {
    const first = productsList[0];
    if (first) setSelectedSku(first.sku);
  }, [productsList]);

  const updateMutation = trpc.orders.update.useMutation({
    onSuccess: () => {
      void utils.orders.get.invalidate();
      void utils.products.list.invalidate();
      options.onRefresh();
    },
  });
  const statusMutation = trpc.orders.setStatus.useMutation({
    onSuccess: () => {
      void utils.orders.get.invalidate();
      options.onRefresh();
    },
  });

  const calculatedTotal = editableItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  const handleItemQtyChange = (idx: number, qty: number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = {
          ...next[idx],
          quantity: Math.max(1, qty),
          lineTotal: Math.max(1, qty) * next[idx].unitPrice,
        };
      }
      return next;
    });
  };

  const handleItemPriceChange = (idx: number, price: number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = {
          ...next[idx],
          unitPrice: Math.max(0, price),
          lineTotal: next[idx].quantity * Math.max(0, price),
        };
      }
      return next;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddProduct = () => {
    if (!order) return;
    const prod = productsList.find((p) => p.sku === selectedSku);
    if (!prod) return;

    setEditableItems((prev) => [
      ...prev,
      {
        id: Math.floor(Math.random() * 10000),
        orderId: order.id,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        quantity: 1,
        unitPrice: prod.unitPrice,
        lineTotal: prod.unitPrice,
      },
    ]);
  };

  const buildItemsPayload = () =>
    editableItems.map((i) => ({
      productId: i.productId ?? undefined,
      sku: i.sku,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));

  const handleSaveEdits = async () => {
    if (!order) return;
    try {
      setIsSaving(true);
      await updateMutation.mutateAsync({
        id: order.id,
        notes,
        proposedMessage: proposedMsg,
        items: buildItemsPayload(),
      });
    } catch (err) {
      console.error("Failed to update order", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAndSend = async () => {
    if (!order) return;
    try {
      setIsSaving(true);
      await updateMutation.mutateAsync({
        id: order.id,
        notes,
        proposedMessage: proposedMsg,
        items: buildItemsPayload(),
      });
      await statusMutation.mutateAsync({
        id: order.id,
        status: "confirmed",
        reason: "Approved by Sales Admin",
        proposedMessage: proposedMsg,
      });
      options.onClose();
    } catch (err) {
      console.error("Failed to approve order", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetStatus = async (status: Order["status"], reason?: string) => {
    if (!order) return;
    try {
      setIsSaving(true);
      await statusMutation.mutateAsync({ id: order.id, status, reason });
      options.onClose();
    } catch (err) {
      console.error("Failed to change order status", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!order) return;
    try {
      setIsSaving(true);
      const isModified =
        JSON.stringify(editableItems) !== JSON.stringify(order.items) ||
        proposedMsg !== (order.proposedMessage ?? "");
      if (isModified) {
        await updateMutation.mutateAsync({
          id: order.id,
          notes,
          proposedMessage: proposedMsg,
          items: buildItemsPayload(),
        });
      }
      await statusMutation.mutateAsync({
        id: order.id,
        status: "completed",
        reason: "Marked as completed by Sales Admin",
      });
      options.onClose();
    } catch (err) {
      console.error("Failed to complete order", err);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    order,
    productsList,
    editableItems,
    proposedMsg,
    notes,
    isSaving,
    selectedSku,
    calculatedTotal,
    setProposedMsg,
    setNotes,
    setSelectedSku,
    handleItemQtyChange,
    handleItemPriceChange,
    handleRemoveItem,
    handleAddProduct,
    handleSaveEdits,
    handleApproveAndSend,
    handleSetStatus,
    handleMarkCompleted,
  };
}
```

Behavior notes: `options.onRefresh()` now fires via mutation `onSuccess` (the old code called it explicitly after each `await` — same observable effect); the post-save `await loadData()` is replaced by `utils.orders.get.invalidate()`.

- [ ] **Step 5: Check + build**

Run: `vp check && vp run -r build`
Expected: green. (`tsc` catches any mismatch between the hook return surface and the two consuming components.)

- [ ] **Step 6: Manual smoke — orders dashboard + review drawer**

With server + website dev running (`vp run whatsapp-webhook#dev`, `vp run website#dev`):

- Dashboard tabs switch and refetch; counts render.
- Search box filters; Refresh button re-fetches.
- Row selection + bulk status action updates and refreshes the list.
- Open order drawer: line items editable; Save, Approve & Send, Set Status, Mark Completed all work and the dashboard list refreshes afterwards.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/trpc.ts apps/website/src/main.tsx apps/website/src/hooks/useOrders.ts apps/website/src/hooks/useOrderReview.ts
git commit -m "feat(trpc): wire client providers and migrate useOrders/useOrderReview"
```

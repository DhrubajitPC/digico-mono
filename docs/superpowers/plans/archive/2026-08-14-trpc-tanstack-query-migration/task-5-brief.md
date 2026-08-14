### Task 5: Component migration

**Files:**

- Create: `apps/website/src/emulator-api.ts`
- Modify: `apps/website/src/components/MessageLogView.tsx`
- Modify: `apps/website/src/components/WhatsAppEmulator.tsx`
- Modify: `apps/website/src/components/CreateOrderModal.tsx`
- Modify (type-only import swaps): `apps/website/src/components/shared/LineItemsEditor.tsx`, `apps/website/src/components/dashboard/OrdersTable.tsx`, `apps/website/src/components/order-review/WhatsAppPreviewBox.tsx`, `apps/website/src/components/order-review/OrderContextPane.tsx`, `apps/website/src/components/order-review/OrderDrawerActionBar.tsx`, `apps/website/src/components/emulator/DealerSelector.tsx`, `apps/website/src/components/emulator/ChatWindow.tsx`, `apps/website/src/components/emulator/ChatBubble.tsx`

**Interfaces:**

- Consumes: `trpc` client, `@digico/contracts` types, and the two REST helpers in `emulator-api.ts`.
- Produces: zero references to `../api.js` anywhere in `apps/website/src` (verified by grep at the end).

- [ ] **Step 1: Create the emulator REST helper** (copied from `api.ts`, typed from `@digico/contracts`)

`apps/website/src/emulator-api.ts`:

```ts
import type { EmulatorChatMessage } from "@digico/contracts";

// The emulator endpoints feed the webhook AI pipeline and stay REST (spec §2.4).

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function sendJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getEmulatorChat(
  phone: string,
): Promise<{ fromPhone: string; messages: EmulatorChatMessage[] }> {
  const params = new URLSearchParams({ phone });
  return getJson<{ fromPhone: string; messages: EmulatorChatMessage[] }>(
    `/api/emulator/chat?${params.toString()}`,
  );
}

export function sendEmulatorMessage(data: {
  fromPhone: string;
  contactName?: string;
  text: string;
}): Promise<{ success: boolean; messageId: string; metaPayload: unknown }> {
  return sendJson<{ success: boolean; messageId: string; metaPayload: unknown }>(
    "/api/emulator/send",
    data,
  );
}
```

- [ ] **Step 2: Migrate `MessageLogView.tsx`**

Replace the import:

```ts
// before
import { listMessages, type LogMessage } from "../api.js";
// after
import { trpc } from "../trpc.js";
import type { LogMessage } from "@digico/contracts";
```

Replace the hand-rolled `fetchMessages` state with a typed query. Keep `phoneFilter`/`statusFilter` client-side filtering and the `selectedMessage` state exactly as they are. The new data wiring:

```ts
const messagesQuery = trpc.messages.list.useQuery();

const messages = useMemo(() => {
  let filtered = messagesQuery.data?.items ?? [];
  if (phoneFilter) filtered = filtered.filter((m) => m.fromPhone.includes(phoneFilter));
  if (statusFilter) filtered = filtered.filter((m) => m.status === statusFilter);
  return filtered;
}, [messagesQuery.data, phoneFilter, statusFilter]);

const fetchMessages = () => {
  void utils.messages.list.invalidate();
};
```

where `const utils = trpc.useUtils();` and `isLoading` becomes `messagesQuery.isFetching` (the Refresh button keeps its `onClick={() => void fetchMessages()}`). Delete the old `useCallback`/`useEffect` fetch block and the now-unused `setMessages` state.

- [ ] **Step 3: Migrate `WhatsAppEmulator.tsx`**

Replace the import block:

```ts
// before
import {
  getEmulatorChat,
  listDealers,
  sendEmulatorMessage,
  type Dealer,
  type EmulatorChatMessage,
} from "../api.js";
// after
import { trpc } from "../trpc.js";
import { getEmulatorChat, sendEmulatorMessage } from "../emulator-api.js";
import type { Dealer, EmulatorChatMessage } from "@digico/contracts";
```

Replace the dealers-mount effect (currently `void listDealers().then(...)` around line 58) with a sync from a typed query:

```ts
const dealersQuery = trpc.dealers.list.useQuery();

useEffect(() => {
  if (dealersQuery.data && dealersQuery.data.length > 0) {
    setDealers(dealersQuery.data);
  }
}, [dealersQuery.data]);
```

`getEmulatorChat` (line ~72) and `sendEmulatorMessage` (line ~102) call sites stay as-is — the imports now come from `../emulator-api.js`.

- [ ] **Step 4: Migrate `CreateOrderModal.tsx`**

Replace the import:

```ts
// before
import { createOrder, listDealers, listProducts, type Dealer, type Product } from "../api.js";
// after
import { trpc } from "../trpc.js";
import type { Dealer, Product } from "@digico/contracts";
```

Replace the mount effect that calls `listDealers`/`listProducts` with typed queries:

```ts
const dealersQuery = trpc.dealers.list.useQuery();
const productsQuery = trpc.products.list.useQuery();
const createMutation = trpc.orders.create.useMutation({
  onSuccess: () => {
    setItems([]);
    setSelectedSku("");
    setAddQty(1);
    setAddPrice("");
    setNotes("");
    setSelectedDealerId("");
    onSuccess();
    onClose();
  },
});

useEffect(() => {
  if (dealersQuery.data) setDealersList(dealersQuery.data);
}, [dealersQuery.data]);
useEffect(() => {
  if (productsQuery.data) setProductsList(productsQuery.data);
}, [productsQuery.data]);
```

Replace the submit handler's `await createOrder({...})` with `await createMutation.mutateAsync({...})`, keeping the same payload keys (`dealerId`, `origin`, `notes`, `items`) and the same `setIsSubmitting` try/finally. Inspect the existing success block in the component and port its reset calls into the mutation `onSuccess` above verbatim.

- [ ] **Step 5: Swap the type-only imports (8 files, mechanical)**

`../api.js` (or `../../api.js`) → `@digico/contracts`, same member names:

| File                                    | Old import                                                | New import                                                                                                   |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `shared/LineItemsEditor.tsx`            | `import type { Product } from "../../api.js"`             | `import type { Product } from "@digico/contracts"`                                                           |
| `dashboard/OrdersTable.tsx`             | `import type { ListOrdersResult } from "../../api.js"`    | `import type { RouterOutputs } from "@digico/api"; type ListOrdersResult = RouterOutputs["orders"]["list"];` |
| `order-review/WhatsAppPreviewBox.tsx`   | `import type { Order } from "../../api.js"`               | `import type { Order } from "@digico/contracts"`                                                             |
| `order-review/OrderContextPane.tsx`     | `import type { Order } from "../../api.js"`               | `import type { Order } from "@digico/contracts"`                                                             |
| `order-review/OrderDrawerActionBar.tsx` | `import type { Order } from "../../api.js"`               | `import type { Order } from "@digico/contracts"`                                                             |
| `emulator/DealerSelector.tsx`           | `import type { Dealer } from "../../api.js"`              | `import type { Dealer } from "@digico/contracts"`                                                            |
| `emulator/ChatWindow.tsx`               | `import type { EmulatorChatMessage } from "../../api.js"` | `import type { EmulatorChatMessage } from "@digico/contracts"`                                               |
| `emulator/ChatBubble.tsx`               | `import type { EmulatorChatMessage } from "../../api.js"` | `import type { EmulatorChatMessage } from "@digico/contracts"`                                               |

For `OrdersTable.tsx`, the component's props keep the name `ListOrdersResult`; only the definition site changes (from an `api.ts` interface to the tRPC-inferred type).

- [ ] **Step 6: Verify no `api.js` references remain + check + build**

Run: `grep -rn "api.js" apps/website/src` → no output (the two hooks were migrated in Task 4).
Run: `vp check && vp run -r build`
Expected: green.

- [ ] **Step 7: Manual smoke — emulator, message log, create-order modal**

- Emulator: dealer dropdown loads from `/trpc`; chat history loads; sending a message still works (via `/api/emulator/send`).
- Message Log: loads rows, filters, refresh.
- Create Order modal: dealer + product dropdowns populate; creating an order shows in the dashboard after close.

- [ ] **Step 8: Commit**

```bash
git add apps/website/src
git commit -m "feat(trpc): migrate components off api.js"
```

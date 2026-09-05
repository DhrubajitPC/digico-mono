import type { RouterInputs, RouterOutputs } from "./router.ts";

export { createContext } from "./context.ts";
export type { TrpcContext } from "./context.ts";
export { appRouter } from "./router.ts";
export type { AppRouter, RouterInputs, RouterOutputs } from "./router.ts";
export { auth } from "./auth//auth.ts";

export * from "./schemas.ts";

// Canonical procedure-specific input and output type aliases
export type OrderListItem = RouterOutputs["orders"]["list"]["items"][number];
export type OrderListOutput = RouterOutputs["orders"]["list"];
export type OrderCounts = RouterOutputs["orders"]["list"]["counts"];
export type OrderDetail = RouterOutputs["orders"]["get"];

export type CreateOrderInput = RouterInputs["orders"]["create"];
export type OrderItemInput = NonNullable<RouterInputs["orders"]["create"]["items"]>[number];
export type UpdateOrderInput = RouterInputs["orders"]["update"];
export type SetOrderStatusInput = RouterInputs["orders"]["setStatus"];
export type BulkSetOrderStatusInput = RouterInputs["orders"]["bulkSetStatus"];

export type DealerListItem = RouterOutputs["dealers"]["list"][number];
export type ProductListItem = RouterOutputs["products"]["list"][number];

export type MessageListItem = RouterOutputs["messages"]["list"]["items"][number];
export type MessageDetailOutput = RouterOutputs["messages"]["get"];

export type ListOrdersInput = RouterInputs["orders"]["list"];
export type ListMessagesInput = NonNullable<RouterInputs["messages"]["list"]>;

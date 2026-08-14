import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { router } from "./trpc.ts";
import { dealersRouter } from "./routers/dealers.ts";
import { healthRouter } from "./routers/health.ts";
import { messagesRouter } from "./routers/messages.ts";
import { ordersRouter } from "./routers/orders.ts";
import { productsRouter } from "./routers/products.ts";

export const appRouter = router({
  health: healthRouter,
  orders: ordersRouter,
  products: productsRouter,
  dealers: dealersRouter,
  messages: messagesRouter,
});

export type AppRouter = typeof appRouter;
export type RouterInputs = inferRouterInputs<typeof appRouter>;
export type RouterOutputs = inferRouterOutputs<typeof appRouter>;

import { router } from "./trpc.ts";
import { healthRouter } from "./routers/health.ts";
import { ordersRouter } from "./routers/orders.ts";

export const appRouter = router({
  health: healthRouter,
  orders: ordersRouter,
});

export type AppRouter = typeof appRouter;

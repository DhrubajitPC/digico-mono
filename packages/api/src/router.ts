import { router } from "./trpc.ts";
import { healthRouter } from "./routers/health.ts";

export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;

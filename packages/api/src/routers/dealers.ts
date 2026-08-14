import { fetchMariaDbDealers } from "@digico/db";
import { publicProcedure, router } from "../trpc.ts";

export const dealersRouter = router({
  list: publicProcedure.query(() => fetchMariaDbDealers()),
});

import { fetchMariaDbProducts } from "@digico/db";
import { publicProcedure, router } from "../trpc.ts";

export const productsRouter = router({
  list: publicProcedure.query(() => fetchMariaDbProducts()),
});

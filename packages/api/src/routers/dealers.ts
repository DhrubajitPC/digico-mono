import { createMariaDbDealer, fetchMariaDbDealers } from "@digico/db";
import { publicProcedure, router } from "../trpc.ts";
import { z } from "zod";

// export const dealersRouter = router({
//   list: publicProcedure.query(() => fetchMariaDbDealers()),
// });

const createDealerInputSchema = z.object({
  businessName: z.string().min(1),
  contactPerson: z.string().nullable().optional(),
  phone: z.string().min(1),
  address: z.string().nullable().optional(),
});

export const dealersRouter = router({
  list: publicProcedure.query(() => fetchMariaDbDealers()),

  create: publicProcedure
    .input(createDealerInputSchema)
    .mutation(({ input }) => createMariaDbDealer(input)),
});

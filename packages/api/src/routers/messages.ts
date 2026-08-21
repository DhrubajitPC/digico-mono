import { TRPCError } from "@trpc/server";
import { getMariaDbMessageDetail, listMariaDbMessages } from "@digico/db";
import { z } from "zod";
import { publicProcedure, router } from "../trpc.ts";
import { listMessagesInputSchema } from "../schemas.ts";

export const messagesRouter = router({
  list: publicProcedure
    .input(listMessagesInputSchema.optional())
    .query(({ input }) => listMariaDbMessages(input)),
  get: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const detail = await getMariaDbMessageDetail(input.id);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Message detail not found" });
      return detail;
    }),
});

import { initTRPC, TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context.ts";
import type { Context } from "./context.js";
import { requirePermission, type Permission, type UserRole } from "./auth/permissions.ts";
// import { getUserRole } from "@digico/db";

// const t = initTRPC.context<TrpcContext>().create();

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});
export function permissionProcedure(permission: Permission) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    // const role = ctx.user.role as UserRole;

    // requirePermission(role, permission);

    return next();
  });
}

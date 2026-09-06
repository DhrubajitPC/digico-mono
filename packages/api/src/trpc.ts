import { initTRPC, TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context.ts";
import type { Context } from "./context.js";
import { auth } from "./auth/auth.ts";

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
export type OrderPermission = "read" | "update" | "setStatus" | "merge";

// export const permissionProcedure = (permission: OrderPermission) =>
//   protectedProcedure.use(async ({ ctx, next }) => {
//     const result = await auth.api.userHasPermission({
//       body: {
//         userId: ctx.session.user.id,
//         permissions: {
//           orders: [permission],
//         },
//       },
//     });

//     if (!result.success) {
//       throw new TRPCError({
//         code: "FORBIDDEN",
//         message: `You do not have permission to perform orders.${permission}`,
//       });
//     }

//     return next();
//   });

export const permissionProcedure = (permission: OrderPermission) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    console.log("RBAC CHECK:", {
      userId: ctx.session.user.id,
      username: ctx.session.user.username,
      role: ctx.session.user.role,
      permission,
    });

    const result = await auth.api.userHasPermission({
      body: {
        userId: ctx.session.user.id,
        permissions: {
          orders: [permission],
        },
      },
    });

    console.log("RBAC RESULT:", result);

    if (!result.success) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You do not have permission to perform orders.${permission}`,
      });
    }

    return next();
  });

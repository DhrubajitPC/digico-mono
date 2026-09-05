/** Empty for now — auth middleware slots in here later (spec §7). */

// export function createContext(): TrpcContext {
//   return {};
// }

import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { auth } from "./auth/auth.ts";

export interface TrpcContext {}

// export async function createContext({ req, res }: CreateFastifyContextOptions) {
//   const headers = new Headers();

//   for (const [key, value] of Object.entries(req.headers)) {
//     if (value !== undefined) {
//       headers.set(key, Array.isArray(value) ? value.join(",") : value);
//     }
//   }

//   const session = await auth.api.getSession({
//     headers,
//   });

//   return {
//     req,
//     res,
//     session,
//   };
// }
export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const headers = new Headers();

  // for (const [key, value] of Object.entries(req.headers)) {
  //   if (value === undefined) {
  //     continue;
  //   }

  //   headers.set(key, Array.isArray(value) ? value.join(",") : value);
  // }
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || value === null) {
      continue;
    }

    const headerValue = Array.isArray(value) ? value.join(",") : String(value);

    headers.set(key, headerValue);
  }

  const session = await auth.api.getSession({
    headers,
  });

  return {
    req,
    res,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

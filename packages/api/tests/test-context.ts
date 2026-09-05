import type { Context } from "../src/context.ts";

export function createTestContext(): Context {
  return {
    req: {} as never,
    res: {} as never,
    session: null,
  };
}

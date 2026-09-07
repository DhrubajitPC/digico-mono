import type { Context } from "../src/context.ts";

export function createTestContext(): Context {
  return {
    req: {} as never,
    res: {} as never,
    session: {
      session: {
        id: "test-session-id",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "test-user-id",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        token: "test-session-token",
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      },
      user: {
        id: "test-user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
        email: "test@example.com",
        emailVerified: true,
        name: "Test User",
        image: null,
        banned: false,
        banExpires: null,
        banReason: null,
        role: "admin",
      },
    },
  };
}

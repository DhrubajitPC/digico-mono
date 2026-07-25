import { expect, test } from "vite-plus/test";
import { createPgliteDb } from "../src/db/pglite.ts";
import { messages } from "../src/db/schema.ts";

test("migrations apply and a message row can be inserted", async () => {
  const db = await createPgliteDb();

  const [row] = await db
    .insert(messages)
    .values({
      messageId: "wamid.TEST123",
      fromPhone: "+8801700000001",
      kind: "text",
      rawPayload: { hello: "world" },
      inboundText: "HP i5 laptop ase?",
    })
    .returning();

  expect(row!.status).toBe("received");
  expect(row!.id).toBe(1);
  expect(row!.completedAt).toBeNull();
});

test("message_id is unique", async () => {
  const db = await createPgliteDb();
  const row = {
    messageId: "wamid.DUPLICATE",
    fromPhone: "+8801700000001",
    kind: "text" as const,
    rawPayload: {},
  };
  await db.insert(messages).values(row);
  await expect(db.insert(messages).values(row)).rejects.toThrow();
});

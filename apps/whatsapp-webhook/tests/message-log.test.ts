import { expect, test } from "vite-plus/test";
import { createPgliteDb } from "../src/db/pglite.ts";
import {
  getMessageDetail,
  listMessages,
  markMessageStatus,
  recordAiCall,
  recordInboundMessage,
  recordOutboundReply,
  setResolvedText,
} from "../src/log/message-log.ts";

async function seedMessage(db: Awaited<ReturnType<typeof createPgliteDb>>, messageId: string) {
  const result = await recordInboundMessage(db, {
    messageId,
    fromPhone: "+8801700000001",
    contactName: "Rahim Traders",
    kind: "text",
    rawPayload: { raw: true },
    inboundText: "HP i5 laptop ase?",
  });
  if (result.outcome !== "created") throw new Error("expected a fresh message");
  return result.message;
}

test("records the full round trip for one message", async () => {
  const db = await createPgliteDb();
  const message = await seedMessage(db, "wamid.A1");

  await setResolvedText(db, message.id, { resolvedText: "HP i5 laptop ase?" });

  await recordAiCall(db, {
    messageId: message.id,
    provider: "deepseek",
    model: "deepseek-chat",
    requestMessages: [{ role: "user", content: "HP i5 laptop ase?" }],
    responseText: "We have a few HP i5 models — which spec do you need?",
    latencyMs: 842,
  });

  await recordOutboundReply(db, {
    messageId: message.id,
    toPhone: "+8801700000001",
    replyText: "We have a few HP i5 models — which spec do you need?",
    status: "sent",
  });

  await markMessageStatus(db, message.id, "completed");

  const detail = await getMessageDetail(db, message.id);
  expect(detail!.message.status).toBe("completed");
  expect(detail!.message.resolvedText).toBe("HP i5 laptop ase?");
  expect(detail!.message.completedAt).not.toBeNull();
  expect(detail!.aiCalls).toHaveLength(1);
  expect(detail!.aiCalls[0]!.latencyMs).toBe(842);
  expect(detail!.outboundReplies).toHaveLength(1);
  expect(detail!.outboundReplies[0]!.status).toBe("sent");
});

test("records a failed AI call and marks the message failed", async () => {
  const db = await createPgliteDb();
  const message = await seedMessage(db, "wamid.A2");

  await recordAiCall(db, {
    messageId: message.id,
    provider: "deepseek",
    model: "deepseek-chat",
    requestMessages: [{ role: "user", content: "HP i5 laptop ase?" }],
    error: "DeepSeek 500: internal error",
    latencyMs: 1200,
  });

  await markMessageStatus(db, message.id, "failed", "DeepSeek 500: internal error");

  const detail = await getMessageDetail(db, message.id);
  expect(detail!.message.status).toBe("failed");
  expect(detail!.message.error).toBe("DeepSeek 500: internal error");
  expect(detail!.aiCalls[0]!.error).toBe("DeepSeek 500: internal error");
  expect(detail!.aiCalls[0]!.responseText).toBeNull();
});

test("getMessageDetail returns undefined for unknown id", async () => {
  const db = await createPgliteDb();
  expect(await getMessageDetail(db, 999)).toBeUndefined();
});

test("listMessages filters by phone and status, newest first, with pagination", async () => {
  const db = await createPgliteDb();
  const m1 = await seedMessage(db, "wamid.B1");
  const m2 = await seedMessage(db, "wamid.B2");
  await recordInboundMessage(db, {
    messageId: "wamid.B3",
    fromPhone: "+8801799999999",
    contactName: null,
    kind: "text",
    rawPayload: {},
    inboundText: "other dealer",
  });

  await markMessageStatus(db, m1.id, "completed");
  await markMessageStatus(db, m2.id, "failed", "boom");

  const forDealer = await listMessages(db, { phone: "+8801700000001" });
  expect(forDealer.total).toBe(2);
  expect(forDealer.items.map((m) => m.messageId)).toEqual(["wamid.B2", "wamid.B1"]);

  const onlyFailed = await listMessages(db, { status: "failed" });
  expect(onlyFailed.items).toHaveLength(1);
  expect(onlyFailed.items[0]!.messageId).toBe("wamid.B2");

  const page = await listMessages(db, { limit: 1, offset: 1 });
  expect(page.total).toBe(3);
  expect(page.items).toHaveLength(1);
});

test("recordInboundMessage reports a duplicate instead of throwing on a repeated messageId", async () => {
  const db = await createPgliteDb();
  const first = await recordInboundMessage(db, {
    messageId: "wamid.DUPE",
    fromPhone: "+8801700000001",
    contactName: null,
    kind: "text",
    rawPayload: {},
    inboundText: "HP i5 laptop ase?",
  });
  expect(first.outcome).toBe("created");

  const second = await recordInboundMessage(db, {
    messageId: "wamid.DUPE",
    fromPhone: "+8801700000001",
    contactName: null,
    kind: "text",
    rawPayload: {},
    inboundText: "HP i5 laptop ase?",
  });
  expect(second.outcome).toBe("duplicate");

  const { total } = await listMessages(db, { phone: "+8801700000001" });
  expect(total).toBe(1);
});

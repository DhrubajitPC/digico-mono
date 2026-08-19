import { beforeEach, expect, test, vi } from "vite-plus/test";

const db = vi.hoisted(() => ({ getEmulatorChatHistory: vi.fn() }));
vi.mock("@digico/db", () => db);

const pipeline = vi.hoisted(() => ({ handleIncomingMessage: vi.fn() }));
vi.mock("../src/services/handle-message.ts", () => pipeline);

import type { IncomingWhatsAppMessage } from "../src/services/parse-webhook.ts";
import { registerEmulatorRoutes } from "../src/routes/emulator.ts";

interface Captured {
  method: string;
  url: string;
  handler: (req: { body: unknown; query?: unknown }, reply: Reply) => Promise<unknown>;
}

interface Reply {
  statusCode: number;
  payload: unknown;
  code: (n: number) => Reply;
  send: (p: unknown) => Reply;
}

/** Minimal Fastify stand-in: captures the registered routes so they can be invoked. */
function fakeApp() {
  const routes: Captured[] = [];
  return {
    routes,
    post(url: string, handler: Captured["handler"]) {
      routes.push({ method: "POST", url, handler });
    },
    get(url: string, handler: Captured["handler"]) {
      routes.push({ method: "GET", url, handler });
    },
  };
}

function fakeReply(): Reply {
  const reply: Reply = {
    statusCode: 200,
    payload: undefined,
    code(n) {
      reply.statusCode = n;
      return reply;
    },
    send(p) {
      reply.payload = p;
      return reply;
    },
  };
  return reply;
}

let send: Captured["handler"];

beforeEach(async () => {
  pipeline.handleIncomingMessage.mockReset();
  const app = fakeApp();
  await registerEmulatorRoutes(app as never);
  send = app.routes.find((r) => r.url === "/api/emulator/send")!.handler;
});

/** "hello" as base64 — small but decodes to real bytes. */
const AUDIO_B64 = Buffer.from("hello").toString("base64");

function dispatched(): IncomingWhatsAppMessage {
  return pipeline.handleIncomingMessage.mock.calls[0]![0] as IncomingWhatsAppMessage;
}

test("routes a voice note through the pipeline with inline bytes attached", async () => {
  const reply = fakeReply();
  await send(
    {
      body: {
        fromPhone: "+8801711000001",
        audio: { data: AUDIO_B64, mimeType: "audio/webm" },
      },
    },
    reply,
  );

  expect(reply.statusCode).toBe(200);
  const msg = dispatched();
  expect(msg.kind).toBe("audio");
  expect(msg.text).toBeNull();
  // The emulator has no Meta media to download, so the bytes must travel inline.
  expect(msg.audio?.inlineBytes).toBeInstanceOf(ArrayBuffer);
  expect(Buffer.from(msg.audio!.inlineBytes!).toString()).toBe("hello");
});

test("keeps the raw audio out of the payload inspector", async () => {
  const reply = fakeReply();
  await send(
    { body: { fromPhone: "+8801711000001", audio: { data: AUDIO_B64, mimeType: "audio/webm" } } },
    reply,
  );

  const payload = reply.payload as { metaPayload: unknown };
  expect(JSON.stringify(payload.metaPayload)).not.toContain(AUDIO_B64);
});

test("still accepts a text message", async () => {
  const reply = fakeReply();
  await send({ body: { fromPhone: "+8801711000001", text: "Conion fridge lagbe" } }, reply);

  expect(reply.statusCode).toBe(200);
  const msg = dispatched();
  expect(msg.kind).toBe("text");
  expect(msg.text).toBe("Conion fridge lagbe");
  expect(msg.audio).toBeNull();
});

test("rejects a request carrying neither text nor audio", async () => {
  const reply = fakeReply();
  await send({ body: { fromPhone: "+8801711000001" } }, reply);

  expect(reply.statusCode).toBe(400);
  expect(pipeline.handleIncomingMessage).not.toHaveBeenCalled();
});

// Buffer.from silently drops non-base64 characters, so a corrupt upload would
// otherwise reach the provider and fail as an opaque transcription error.
test("rejects audio that is not base64", async () => {
  const reply = fakeReply();
  await send(
    {
      body: {
        fromPhone: "+8801711000001",
        audio: { data: "not base64!!", mimeType: "audio/webm" },
      },
    },
    reply,
  );

  expect(reply.statusCode).toBe(400);
  expect(pipeline.handleIncomingMessage).not.toHaveBeenCalled();
});

test("rejects audio beyond the WhatsApp size ceiling", async () => {
  const reply = fakeReply();
  await send(
    {
      body: {
        fromPhone: "+8801711000001",
        audio: { data: "A".repeat(23 * 1024 * 1024), mimeType: "audio/webm" },
      },
    },
    reply,
  );

  expect(reply.statusCode).toBe(400);
  expect(pipeline.handleIncomingMessage).not.toHaveBeenCalled();
});

test("requires a phone number", async () => {
  const reply = fakeReply();
  await send({ body: { text: "hi" } }, reply);

  expect(reply.statusCode).toBe(400);
});

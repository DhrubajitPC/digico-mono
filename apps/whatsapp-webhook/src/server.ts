import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { getMessageForApi, listMessagesForApi } from "./api-messages.ts";
import { getDb } from "./db/instance.ts";
import { handleIncomingMessage } from "./handle-message.ts";
import { parseIncomingMessages } from "./parse-webhook.ts";

const PORT = Number(process.env.PORT ?? 8787);
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

if (!VERIFY_TOKEN) {
  console.error("Missing WHATSAPP_VERIFY_TOKEN in environment (.env)");
  process.exit(1);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: string, contentType = "text/plain") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  send(res, status, JSON.stringify(body), "application/json");
}

const MESSAGE_DETAIL_PATH = /^\/api\/messages\/(\d+)$/;
const ORDER_DETAIL_PATH = /^\/api\/orders\/(\d+)$/;
const ORDER_STATUS_PATH = /^\/api\/orders\/(\d+)\/status$/;

/** Read-only & write dashboard API: message log & orders management. */
async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const db = await getDb();

  // GET /api/messages
  if (req.method === "GET" && path === "/api/messages") {
    sendJson(res, 200, await listMessagesForApi(db, url.searchParams));
    return true;
  }

  // GET /api/messages/:id
  const messageDetailMatch = MESSAGE_DETAIL_PATH.exec(path);
  if (req.method === "GET" && messageDetailMatch) {
    const detail = await getMessageForApi(db, messageDetailMatch[1]!);
    if (!detail) {
      sendJson(res, 404, { error: "Message not found" });
      return true;
    }
    sendJson(res, 200, detail);
    return true;
  }

  // --- ORDERS API ROUTES ---
  const {
    listOrdersForApi,
    getOrderForApi,
    createOrderForApi,
    updateOrderForApi,
    updateOrderStatusForApi,
    bulkUpdateOrderStatusForApi,
    listProductsForApi,
    listDealersForApi,
  } = await import("./api-orders.ts");

  // GET /api/orders
  if (req.method === "GET" && path === "/api/orders") {
    sendJson(res, 200, await listOrdersForApi(db, url.searchParams));
    return true;
  }

  // GET /api/products
  if (req.method === "GET" && path === "/api/products") {
    sendJson(res, 200, await listProductsForApi(db));
    return true;
  }

  // GET /api/dealers
  if (req.method === "GET" && path === "/api/dealers") {
    sendJson(res, 200, await listDealersForApi(db));
    return true;
  }

  // POST /api/orders (Create Manual Order)
  if (req.method === "POST" && path === "/api/orders") {
    const raw = await readBody(req);
    const body = JSON.parse(raw);
    const created = await createOrderForApi(db, body);
    sendJson(res, 201, created);
    return true;
  }

  // POST /api/orders/bulk-status
  if (req.method === "POST" && path === "/api/orders/bulk-status") {
    const raw = await readBody(req);
    const body = JSON.parse(raw);
    const result = await bulkUpdateOrderStatusForApi(db, body.orderIds, body.status, body.reason);
    sendJson(res, 200, result);
    return true;
  }

  // POST /api/orders/:id/status
  const statusMatch = ORDER_STATUS_PATH.exec(path);
  if (req.method === "POST" && statusMatch) {
    const id = Number(statusMatch[1]);
    const raw = await readBody(req);
    const body = JSON.parse(raw);
    const updated = await updateOrderStatusForApi(
      db,
      id,
      body.status,
      body.reason,
      body.proposedMessage,
    );
    if (!updated) {
      sendJson(res, 404, { error: "Order not found" });
      return true;
    }
    sendJson(res, 200, updated);
    return true;
  }

  // GET /api/orders/:id
  const orderDetailMatch = ORDER_DETAIL_PATH.exec(path);
  if (req.method === "GET" && orderDetailMatch) {
    const id = Number(orderDetailMatch[1]);
    const detail = await getOrderForApi(db, id);
    if (!detail) {
      sendJson(res, 404, { error: "Order not found" });
      return true;
    }
    sendJson(res, 200, detail);
    return true;
  }

  // PATCH /api/orders/:id
  if (req.method === "PATCH" && orderDetailMatch) {
    const id = Number(orderDetailMatch[1]);
    const raw = await readBody(req);
    const body = JSON.parse(raw);
    const updated = await updateOrderForApi(db, id, body);
    if (!updated) {
      sendJson(res, 404, { error: "Order not found" });
      return true;
    }
    sendJson(res, 200, updated);
    return true;
  }

  return false;
}

function handleVerify(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    console.log("Webhook verified");
    send(res, 200, challenge);
    return;
  }

  console.warn("Webhook verification failed", { mode, tokenMatched: token === VERIFY_TOKEN });
  send(res, 403, "Forbidden");
}

async function handleIncoming(req: IncomingMessage, res: ServerResponse) {
  const raw = await readBody(req);

  let body: unknown;
  try {
    body = raw.length > 0 ? JSON.parse(raw) : null;
  } catch {
    send(res, 400, "Invalid JSON");
    return;
  }

  const messages = parseIncomingMessages(body);

  // Ack Meta immediately — LLM + WhatsApp send run after.
  send(res, 200, "EVENT_RECEIVED");

  if (messages.length === 0) {
    console.log("Webhook event (no inbound text/audio messages)");
    return;
  }

  for (const message of messages) {
    void handleIncomingMessage(message).catch((error: unknown) => {
      console.error("Failed to handle message", message.messageId, error);
    });
  }
}

const server = createServer(async (req, res) => {
  try {
    const path = (req.url ?? "/").split("?")[0];

    if (req.method === "GET" && path === "/health") {
      send(res, 200, "ok");
      return;
    }

    if (path.startsWith("/api/")) {
      const handled = await handleApiRequest(req, res, path);
      if (handled) return;
    }

    if (path === "/webhook") {
      if (req.method === "GET") {
        handleVerify(req, res);
        return;
      }
      if (req.method === "POST") {
        await handleIncoming(req, res);
        return;
      }
    }

    send(res, 404, "Not Found");
  } catch (error) {
    console.error("Request failed", error);
    if (!res.headersSent) send(res, 500, "Internal Server Error");
  }
});

function requireEnv(name: string) {
  if (!process.env[name]) {
    console.warn(`Warning: ${name} is not set — replies will fail until it is.`);
  }
}

requireEnv("DEEPSEEK_API_KEY");
requireEnv("WHATSAPP_ACCESS_TOKEN");
requireEnv("WHATSAPP_PHONE_NUMBER_ID");
requireEnv("OPENAI_API_KEY"); // Whisper transcription for voice notes

server.listen(PORT, () => {
  console.log(`WhatsApp webhook listening on http://localhost:${PORT}`);
  console.log(`Verify endpoint: GET  /webhook`);
  console.log(`Receive endpoint: POST /webhook`);
  console.log(`Health:           GET  /health`);
});

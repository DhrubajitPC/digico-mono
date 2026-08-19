import { beforeEach, expect, test, vi } from "vite-plus/test";
import { downloadWhatsAppMedia } from "../src/services/whatsapp-media.ts";

vi.mock("@digico/db", () => ({
  MariaDbError: class MariaDbError extends Error {},
  createMariaDbOrder: vi.fn(),
  fetchMariaDbProducts: vi.fn(),
  fetchMariaDbOrders: vi.fn(),
  getMariaDbRecentConversationHistory: vi.fn(),
  markMariaDbMessageStatus: vi.fn(),
  recordMariaDbAiCall: vi.fn(),
  recordMariaDbInboundMessage: vi.fn(),
  recordMariaDbOutboundReply: vi.fn(),
  searchMariaDbProducts: vi.fn(),
  setMariaDbResolvedText: vi.fn(),
}));

vi.mock("../src/services/whatsapp-media.ts", () => ({ downloadWhatsAppMedia: vi.fn() }));

import { resolveAudioMedia } from "../src/services/handle-message.ts";

beforeEach(() => {
  vi.clearAllMocks();
});

// Without this branch the emulator's synthetic media id would be sent to
// graph.facebook.com, which cannot serve it.
test("uses inline bytes without touching the Meta CDN", async () => {
  const bytes = new Uint8Array([1, 2, 3]).buffer;

  const media = await resolveAudioMedia({
    mediaId: "wamid.HBgL123EMULATOR-media",
    mimeType: "audio/webm",
    inlineBytes: bytes,
  });

  expect(media.bytes).toBe(bytes);
  expect(media.mimeType).toBe("audio/webm");
  expect(downloadWhatsAppMedia).not.toHaveBeenCalled();
});

test("downloads from Meta when no inline bytes are present", async () => {
  const downloaded = { bytes: new ArrayBuffer(4), mimeType: "audio/ogg" };
  vi.mocked(downloadWhatsAppMedia).mockResolvedValue(downloaded);

  const media = await resolveAudioMedia({ mediaId: "real-media-id", mimeType: "audio/ogg" });

  expect(downloadWhatsAppMedia).toHaveBeenCalledWith("real-media-id");
  expect(media).toBe(downloaded);
});

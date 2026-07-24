export type DownloadedMedia = {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
};

/**
 * Download media bytes from WhatsApp Cloud API by media id.
 * 1) Resolve media URL  2) Fetch binary with the same access token.
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<DownloadedMedia> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("Missing WHATSAPP_ACCESS_TOKEN");

  const metaRes = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) {
    throw new Error(`WhatsApp media meta ${metaRes.status}: ${await metaRes.text()}`);
  }

  const meta: unknown = await metaRes.json();
  if (typeof meta !== "object" || meta === null) {
    throw new Error("WhatsApp media meta: invalid JSON");
  }
  const url = "url" in meta && typeof meta.url === "string" ? meta.url : null;
  const mimeType =
    "mime_type" in meta && typeof meta.mime_type === "string"
      ? meta.mime_type
      : "application/octet-stream";
  if (!url) throw new Error("WhatsApp media meta missing url");

  const binRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!binRes.ok) {
    throw new Error(`WhatsApp media download ${binRes.status}: ${await binRes.text()}`);
  }

  const bytes = new Uint8Array(await binRes.arrayBuffer());
  return {
    bytes,
    mimeType,
    filename: filenameForMime(mimeType, mediaId),
  };
}

function filenameForMime(mimeType: string, mediaId: string): string {
  const base = mimeType.split(";")[0]?.trim() ?? "application/octet-stream";
  if (base.includes("ogg")) return `${mediaId}.ogg`;
  if (base.includes("mpeg") || base.includes("mp3")) return `${mediaId}.mp3`;
  if (base.includes("mp4") || base.includes("m4a")) return `${mediaId}.m4a`;
  if (base.includes("wav")) return `${mediaId}.wav`;
  if (base.includes("webm")) return `${mediaId}.webm`;
  return `${mediaId}.bin`;
}

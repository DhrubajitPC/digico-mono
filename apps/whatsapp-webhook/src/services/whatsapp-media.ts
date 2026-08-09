export interface DownloadedMedia {
  bytes: ArrayBuffer;
  mimeType: string;
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<DownloadedMedia> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is required to download media");
  }

  // Step 1: Query Meta Graph API for media URL
  const metaUrl = `https://graph.facebook.com/v19.0/${mediaId}`;
  const resMeta = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resMeta.ok) {
    const text = await resMeta.text();
    throw new Error(`Meta media metadata API error (${resMeta.status}): ${text}`);
  }

  const data = (await resMeta.json()) as { url?: string; mime_type?: string };
  if (!data.url) {
    throw new Error(`Meta media metadata API response missing url: ${JSON.stringify(data)}`);
  }

  // Step 2: Download binary stream from CDN
  const resDownload = await fetch(data.url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resDownload.ok) {
    const text = await resDownload.text();
    throw new Error(`Meta media download API error (${resDownload.status}): ${text}`);
  }

  const bytes = await resDownload.arrayBuffer();
  return {
    bytes,
    mimeType: data.mime_type ?? "audio/ogg",
  };
}

import type { DownloadedMedia } from "./whatsapp-media.ts";

/**
 * Transcribe audio with OpenAI Whisper (DeepSeek has no STT API).
 * Set OPENAI_API_KEY in .env.
 */
export async function transcribeAudio(media: DownloadedMedia): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY (needed for voice note transcription)");

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1";

  const form = new FormData();
  form.append("model", model);
  form.append("file", new Blob([media.bytes], { type: media.mimeType }), media.filename);
  // Bengali/Banglish voice notes — let Whisper auto-detect if unset.
  const language = process.env.OPENAI_TRANSCRIBE_LANGUAGE;
  if (language) form.append("language", language);

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Whisper ${response.status}: ${await response.text()}`);
  }

  const data: unknown = await response.json();
  const text =
    typeof data === "object" && data !== null && "text" in data && typeof data.text === "string"
      ? data.text.trim()
      : "";

  if (!text) throw new Error("Whisper returned empty transcript");
  return text;
}

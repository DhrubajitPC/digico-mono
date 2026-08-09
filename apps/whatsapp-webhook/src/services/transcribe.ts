import type { DownloadedMedia } from "./whatsapp-media.ts";

export async function transcribeAudio(media: DownloadedMedia): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for voice transcription");
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1";
  const language = process.env.OPENAI_TRANSCRIBE_LANGUAGE ?? "bn";
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  const blob = new Blob([media.bytes], { type: media.mimeType });
  const formData = new FormData();
  formData.append("file", blob, "voice-note.ogg");
  formData.append("model", model);
  formData.append("language", language);

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI Whisper API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { text?: string };
  if (!data.text) {
    throw new Error(`OpenAI Whisper API returned no transcript text: ${JSON.stringify(data)}`);
  }

  return data.text.trim();
}

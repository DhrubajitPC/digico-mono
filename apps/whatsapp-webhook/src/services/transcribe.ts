import type { DownloadedMedia } from "./whatsapp-media.ts";

const SCRIBE_ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";

/**
 * Terms biased into recognition so dealer product names come back in Latin
 * script. This matters more than raw accuracy: searchMariaDbProducts matches
 * transcripts against English catalog rows, so a transliterated "HP" retrieves
 * nothing and DeepSeek ends up reasoning over the wrong candidates.
 *
 * Keep this at or under 100 entries — past that ElevenLabs bills every request
 * at a 20-second minimum, and dealer voice notes are routinely shorter.
 *
 * The brand list is duplicated in deepseek.ts's system prompt; they are kept
 * separate deliberately, since that prompt is prose and this is a lookup set.
 */
const KEYTERMS = [
  // Brands Digico distributes
  "Conion",
  "Panasonic",
  "HP",
  "Lenovo",
  "Dell",
  "Samsung",
  "Logitech",
  // Product nouns dealers say in English mid-sentence
  "laptop",
  "monitor",
  "printer",
  "keyboard",
  "mouse",
  "router",
  "refrigerator",
  "freezer",
  "microwave",
  "blender",
  "grinder",
  "toaster",
  "sandwich maker",
  "generator",
  "air conditioner",
  "washing machine",
  "rice cooker",
  "induction cooker",
  "water pump",
  "ceiling fan",
];

export async function transcribeAudio(media: DownloadedMedia): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured for voice transcription");
  }

  const model = process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2";

  const formData = new FormData();
  formData.append("file", new Blob([media.bytes], { type: media.mimeType }), "voice-note.ogg");
  formData.append("model_id", model);

  // Left unset on purpose. Scribe auto-detects language and handles
  // code-switching, which is what keeps English product names in Latin script
  // inside otherwise-Bengali speech. Pinning this to Bengali pushes the whole
  // transcript into Bengali script and breaks catalog matching downstream.
  const language = process.env.ELEVENLABS_STT_LANGUAGE;
  if (language) {
    formData.append("language_code", language);
  }

  // Sent as repeated fields. If ElevenLabs rejects this shape, the 422 body is
  // surfaced in the error below — switch to a single JSON-encoded value here.
  for (const term of KEYTERMS) {
    formData.append("keyterms", term);
  }

  const res = await fetch(SCRIBE_ENDPOINT, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs Scribe API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    text?: string;
    language_code?: string;
    language_probability?: number;
  };

  if (!data.text) {
    throw new Error(`ElevenLabs Scribe API returned no transcript text: ${JSON.stringify(data)}`);
  }

  // Low confidence here is the signature of the failure mode that rules out
  // Whisper for this audio: the model settles on the wrong language and
  // confabulates. Worth seeing in the logs before a bad order is drafted.
  if (typeof data.language_probability === "number" && data.language_probability < 0.5) {
    console.warn("Low transcription language confidence", {
      languageCode: data.language_code,
      languageProbability: data.language_probability,
    });
  }

  return data.text.trim();
}

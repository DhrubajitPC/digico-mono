import type { DownloadedMedia } from "./whatsapp-media.ts";

const DEFAULT_BASE_URL = "https://api.elevenlabs.io/v1";

/** A hung STT call would otherwise strand the message: see the timeout note below. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Terms biased into recognition so dealer product names come back in Latin
 * script. This matters more than raw accuracy: searchMariaDbProducts scores
 * transcripts against Latin-script catalog rows, so a transliterated "Conion"
 * retrieves nothing and DeepSeek reasons over the wrong candidates.
 *
 * Derived from the live catalog, not from memory — an earlier version of this
 * list named HP, Lenovo, Dell and Logitech, which have **zero** published
 * products, while omitting the actual top brands. Regenerate with:
 *
 *   SELECT SUBSTRING_INDEX(post_title,' ',1) AS brand, COUNT(*) c
 *   FROM joy_posts WHERE post_type='product' AND post_status='publish'
 *   GROUP BY brand ORDER BY c DESC;
 *
 * Keep the total at or under 100 entries — past that ElevenLabs bills every
 * request at a 20-second minimum, and dealer voice notes are routinely shorter.
 */
const KEYTERMS = [
  // Brands, ordered by published product count
  "Conion",
  "Samsung",
  "Baseus",
  "Whirlpool",
  "Hitachi",
  "Yison",
  "Philips",
  "Recci",
  "Panasonic",
  "Sharp",
  "Hisense",
  "UGREEN",
  "LG",
  "Xiaomi",
  "Haier",
  "Vyvylabs",
  "Toshiba",
  "Riversong",
  "TECNO",
  "Midea",
  "boAt",
  "KENT",
  "Redmi",
  "Livpure",
  "Gree",
  "Sony",
  "Jusal",
  "EcoFlow",
  "Saffron",
  "TCL",
  "HUAWEI",
  "Hafele",
  "V-Guard",
  "Choetech",
  // Product nouns dealers say in English mid-sentence, by catalog frequency
  "refrigerator",
  "television",
  "air conditioner",
  "cable",
  "washing machine",
  "freezer",
  "power bank",
  "fan",
  "oven",
  "grinder",
  "water purifier",
  "smart watch",
  "charger",
  "speaker",
  "earphone",
  "earbuds",
  "neckband",
  "headphone",
  "rice cooker",
  "adapter",
  "microwave",
  "blender",
  "geyser",
  "scooter",
];

export async function transcribeAudio(media: DownloadedMedia): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured for voice transcription");
  }

  // `||` not `??`: an env var set but left blank ("ELEVENLABS_STT_MODEL=") must
  // fall back rather than post model_id="" and earn a 422 on every voice note.
  const model = process.env.ELEVENLABS_STT_MODEL || "scribe_v2";
  const baseUrl = process.env.ELEVENLABS_BASE_URL || DEFAULT_BASE_URL;

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

  // Keyterm prompting is a Scribe v2 feature. Gated so that overriding the model
  // to v1 degrades to plain transcription instead of failing the request
  // outright. Sent as repeated fields — if ElevenLabs rejects this shape, the
  // response body surfaces in the error below; switch to a single JSON value.
  if (model.startsWith("scribe_v2")) {
    for (const term of KEYTERMS) {
      formData.append("keyterms", term);
    }
  }

  const res = await fetch(`${baseUrl}/speech-to-text`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
    // webhook.ts dispatches handleIncomingMessage detached, after Meta already
    // got its 200. Without a deadline a stalled provider means the promise never
    // settles, the catch never runs, and the dealer gets silence rather than the
    // "type it instead" fallback.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs Scribe API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    text?: unknown;
    language_code?: string;
    language_probability?: number;
  };

  // Typed as unknown and checked here rather than trusted from the cast: the
  // response shape is unverified against the live API, and `data.text.trim()` on
  // a non-string would throw an opaque TypeError that reads like an audio
  // failure instead of a contract change.
  if (typeof data.text !== "string") {
    throw new Error(`ElevenLabs Scribe API returned no transcript text: ${JSON.stringify(data)}`);
  }

  // Trim before the emptiness check, not after. A whitespace-only transcript is
  // truthy, so returning it unchecked sent "" downstream, where the empty-query
  // branch of searchMariaDbProducts hands DeepSeek ten arbitrary products and it
  // answers a question the dealer never asked.
  const transcript = data.text.trim();
  if (!transcript) {
    throw new Error("ElevenLabs Scribe API returned an empty transcript");
  }

  // Low confidence here is the signature of the failure mode that ruled out
  // Whisper for this audio: the model settles on the wrong language and
  // confabulates. Worth seeing in the logs before a bad order is drafted.
  if (typeof data.language_probability === "number" && data.language_probability < 0.5) {
    console.warn("Low transcription language confidence", {
      languageCode: data.language_code,
      languageProbability: data.language_probability,
    });
  }

  return transcript;
}

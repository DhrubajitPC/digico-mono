import { afterEach, expect, test } from "vite-plus/test";
import { transcribeAudio } from "../src/services/transcribe.ts";

const originalFetch = globalThis.fetch;

/** Every env var transcribeAudio reads, snapshotted so tests cannot leak into each other. */
const ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_STT_MODEL",
  "ELEVENLABS_STT_LANGUAGE",
  "ELEVENLABS_BASE_URL",
] as const;
const originalEnv = new Map(ENV_KEYS.map((k) => [k, process.env[k]]));

interface CapturedCall {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  form: FormData;
}

/** Stubs the Scribe endpoint and captures the outbound request for assertions. */
function stubScribe(
  payload: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
): CapturedCall[] {
  const calls: CapturedCall[] = [];

  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method,
      headers: (init.headers ?? {}) as Record<string, string>,
      form: init.body as FormData,
    });
    return Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(typeof payload === "string" ? payload : JSON.stringify(payload)),
    } as Response);
  }) as unknown as typeof globalThis.fetch;

  return calls;
}

function voiceNote() {
  return { bytes: new ArrayBuffer(8), mimeType: "audio/ogg" };
}

/** Clears every read env var, then sets only what the test needs. */
function withEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(overrides)) process.env[key] = value;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("throws a configuration error when the API key is absent", async () => {
  withEnv();
  await expect(transcribeAudio(voiceNote())).rejects.toThrow("ELEVENLABS_API_KEY");
});

test("posts the voice note to Scribe with the xi-api-key header", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key" });
  const calls = stubScribe({ text: "10 ta Conion refrigerator lagbe" });

  await transcribeAudio(voiceNote());

  expect(calls).toHaveLength(1);
  const call = calls[0]!;
  expect(call.url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
  expect(call.method).toBe("POST");
  expect(call.headers["xi-api-key"]).toBe("test-key");
  expect(call.form.get("model_id")).toBe("scribe_v2");
  expect(call.form.get("file")).toBeInstanceOf(Blob);
});

test("honours a base URL override so the call can be proxied or recorded", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key", ELEVENLABS_BASE_URL: "http://localhost:9999/v1" });
  const calls = stubScribe({ text: "ok" });

  await transcribeAudio(voiceNote());

  expect(calls[0]!.url).toBe("http://localhost:9999/v1/speech-to-text");
});

test("omits language_code so Scribe auto-detects and preserves code-switching", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key" });
  const calls = stubScribe({ text: "ok" });

  await transcribeAudio(voiceNote());

  expect(calls[0]!.form.get("language_code")).toBeNull();
});

test("forces language_code only when explicitly configured", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key", ELEVENLABS_STT_LANGUAGE: "ben" });
  const calls = stubScribe({ text: "ok" });

  await transcribeAudio(voiceNote());

  expect(calls[0]!.form.get("language_code")).toBe("ben");
});

// A blank override would otherwise post model_id="" and 422 every voice note.
test("falls back to the default model when the override is blank", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key", ELEVENLABS_STT_MODEL: "" });
  const calls = stubScribe({ text: "ok" });

  await transcribeAudio(voiceNote());

  expect(calls[0]!.form.get("model_id")).toBe("scribe_v2");
});

test("biases recognition toward brands that exist in the catalog", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key" });
  const calls = stubScribe({ text: "ok" });

  await transcribeAudio(voiceNote());

  const keyterms = calls[0]!.form.getAll("keyterms");
  for (const brand of ["Conion", "Samsung", "Philips", "UGREEN", "Whirlpool"]) {
    expect(keyterms).toContain(brand);
  }
  // These have zero published products; biasing toward them wastes the budget
  // and was the original defect in this list.
  for (const absent of ["HP", "Lenovo", "Dell", "Logitech"]) {
    expect(keyterms).not.toContain(absent);
  }
  // Past 100 keyterms ElevenLabs bills a 20-second minimum per request, which
  // would inflate every short dealer voice note.
  expect(keyterms.length).toBeLessThanOrEqual(100);
});

// Keyterm prompting is Scribe v2-only; on v1 it should degrade, not fail.
test("omits keyterms when a non-v2 model is selected", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key", ELEVENLABS_STT_MODEL: "scribe_v1" });
  const calls = stubScribe({ text: "ok" });

  await transcribeAudio(voiceNote());

  expect(calls[0]!.form.getAll("keyterms")).toEqual([]);
});

test("returns the trimmed transcript", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key" });
  stubScribe({ text: "  10 ta Conion refrigerator lagbe  " });

  await expect(transcribeAudio(voiceNote())).resolves.toBe("10 ta Conion refrigerator lagbe");
});

// Returning "" here let searchMariaDbProducts take its empty-query branch and
// hand DeepSeek ten arbitrary products for a request that was never made.
test("rejects a whitespace-only transcript instead of returning an empty string", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key" });
  stubScribe({ text: "  \n " });

  await expect(transcribeAudio(voiceNote())).rejects.toThrow(/empty transcript/i);
});

test("surfaces the API response body when the request fails", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key" });
  stubScribe("keyterms field is invalid", { ok: false, status: 422 });

  await expect(transcribeAudio(voiceNote())).rejects.toThrow("keyterms field is invalid");
});

test("throws when the response carries no transcript text", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key" });
  stubScribe({ language_code: "ben" });

  await expect(transcribeAudio(voiceNote())).rejects.toThrow(/no transcript text/i);
});

// A vendor contract change should name itself, not surface as "trim is not a function".
test("throws a contract error when text is not a string", async () => {
  withEnv({ ELEVENLABS_API_KEY: "test-key" });
  stubScribe({ text: { segments: [] } });

  await expect(transcribeAudio(voiceNote())).rejects.toThrow(/no transcript text/i);
});

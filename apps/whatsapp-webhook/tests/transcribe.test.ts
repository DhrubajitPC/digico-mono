import { afterEach, expect, test } from "vite-plus/test";
import { transcribeAudio } from "../src/services/transcribe.ts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.ELEVENLABS_API_KEY;
const originalLanguage = process.env.ELEVENLABS_STT_LANGUAGE;

interface CapturedCall {
  url: string;
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

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv("ELEVENLABS_API_KEY", originalKey);
  restoreEnv("ELEVENLABS_STT_LANGUAGE", originalLanguage);
});

test("throws a configuration error when the API key is absent", async () => {
  delete process.env.ELEVENLABS_API_KEY;
  await expect(transcribeAudio(voiceNote())).rejects.toThrow("ELEVENLABS_API_KEY");
});

test("posts the voice note to Scribe with the xi-api-key header", async () => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  const calls = stubScribe({ text: "10 ta HP laptop lagbe" });

  await transcribeAudio(voiceNote());

  expect(calls).toHaveLength(1);
  const call = calls[0]!;
  expect(call.url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
  expect(call.headers["xi-api-key"]).toBe("test-key");
  expect(call.form.get("model_id")).toBe("scribe_v2");
  expect(call.form.get("file")).toBeInstanceOf(Blob);
});

test("omits language_code so Scribe auto-detects and preserves code-switching", async () => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  delete process.env.ELEVENLABS_STT_LANGUAGE;
  const calls = stubScribe({ text: "ok" });

  await transcribeAudio(voiceNote());

  expect(calls[0]!.form.get("language_code")).toBeNull();
});

test("forces language_code only when explicitly configured", async () => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  process.env.ELEVENLABS_STT_LANGUAGE = "ben";
  const calls = stubScribe({ text: "ok" });

  await transcribeAudio(voiceNote());

  expect(calls[0]!.form.get("language_code")).toBe("ben");
});

test("biases recognition toward catalog brand names", async () => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  const calls = stubScribe({ text: "ok" });

  await transcribeAudio(voiceNote());

  const keyterms = calls[0]!.form.getAll("keyterms");
  expect(keyterms).toContain("HP");
  expect(keyterms).toContain("Conion");
  expect(keyterms).toContain("Panasonic");
  // Past 100 keyterms ElevenLabs bills a 20-second minimum per request, which
  // would inflate every short dealer voice note.
  expect(keyterms.length).toBeLessThanOrEqual(100);
});

test("returns the trimmed transcript", async () => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  stubScribe({ text: "  10 ta HP laptop lagbe  " });

  await expect(transcribeAudio(voiceNote())).resolves.toBe("10 ta HP laptop lagbe");
});

test("surfaces the API response body when the request fails", async () => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  stubScribe("keyterms field is invalid", { ok: false, status: 422 });

  await expect(transcribeAudio(voiceNote())).rejects.toThrow("keyterms field is invalid");
});

test("throws when the response carries no transcript text", async () => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  stubScribe({ language_code: "ben" });

  await expect(transcribeAudio(voiceNote())).rejects.toThrow(/no transcript text/i);
});

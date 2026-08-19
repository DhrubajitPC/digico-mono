import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceRecording {
  /** Base64 payload, no data: prefix. */
  data: string;
  mimeType: string;
}

/**
 * Container preference, best first.
 *
 * Note this is NOT what production receives: WhatsApp delivers
 * audio/ogg;codecs=opus, while Chrome records WebM/Opus and Safari MP4/AAC. The
 * emulator therefore exercises transcription, keyterms, and catalog retrieval,
 * but not the exact container a dealer's voice note arrives in.
 */
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the recording"));
    reader.onload = () => {
      // readAsDataURL always yields a string; narrow rather than coerce the union.
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read the recording"));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Mic capture for the emulator composer.
 *
 * `stop()` resolves with the recording so the caller can send it directly; there
 * is no intermediate state to coordinate. `cancel()` discards it.
 */
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  /** Releases the mic so the browser's recording indicator clears. */
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => releaseStream, [releaseStream]);

  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const start = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      setError("This browser cannot record audio");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setIsRecording(true);
    } catch {
      // Overwhelmingly a denied permission prompt; no other cause is actionable.
      releaseStream();
      setError("Microphone access was denied");
    }
  }, [releaseStream]);

  const stop = useCallback(async (): Promise<VoiceRecording | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      recorder.stop();
    });

    recorderRef.current = null;
    releaseStream();
    setIsRecording(false);

    if (blob.size === 0) {
      setError("Nothing was recorded");
      return null;
    }

    try {
      return { data: await toBase64(blob), mimeType: blob.type || "audio/webm" };
    } catch {
      setError("Could not read the recording");
      return null;
    }
  }, [releaseStream]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    releaseStream();
    setIsRecording(false);
    setSeconds(0);
  }, [releaseStream]);

  return { isRecording, seconds, error, start, stop, cancel };
}

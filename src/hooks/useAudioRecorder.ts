"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "stopped";

export interface UseAudioRecorderReturn {
  state: RecorderState;
  audioBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  reset: () => void;
}

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"];

function getSupportedMimeType(): string {
  for (const mime of MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "audio/webm";
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        console.log("[Recorder] Data chunk:", e.data.size, "bytes");
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          console.log("[Recorder] Final blob:", blob.size, "bytes, chunks:", chunksRef.current.length, "type:", mimeType);
          setAudioBlob(blob);
        } else {
          console.warn("[Recorder] No audio chunks recorded!");
        }
        setState("stopped");
      };

      recorder.onerror = (e) => {
        setError("Recording error");
        setState("idle");
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100); // Capture in 100ms chunks
      console.log("[Recorder] Started recording, mimeType:", mimeType);
      setState("recording");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to access microphone";
      setError(msg);
      setState("idle");
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || state !== "recording") return null;

    return new Promise((resolve) => {
      const onStop = () => {
        recorder.removeEventListener("stop", onStop);
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: recorder.mimeType })
          : null;
        setAudioBlob(blob);
        resolve(blob);
      };
      recorder.addEventListener("stop", onStop);
      recorder.stop();
    });
  }, [state]);

  const reset = useCallback(() => {
    setState("idle");
    setAudioBlob(null);
    setError(null);
    chunksRef.current = [];
    mediaRecorderRef.current = null;
  }, []);

  return {
    state,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    reset,
  };
}

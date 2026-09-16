/**
 * Playback for Hank's spoken answers.
 *
 * Audio is produced on demand by the server and played once; nothing is kept.
 * A voice failure never touches the written answer — the caller just gets a
 * message it can show quietly.
 *
 * This hook is the single playback point for the whole app, so later
 * microphone/push-to-talk work can reuse it as the "speaker" end of a full
 * voice conversation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { speakHankText } from "@/lib/voice.functions";

type Result = { ok: boolean; mimeType?: string; audioBase64?: string; message?: string };

export function useHankSpeech() {
  const speak = useServerFn(speakHankText);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Listens in on the audio as it plays so the voice bar can follow it. The
  // sound still goes to the speakers untouched.
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const samplesRef = useRef<Float32Array | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlayingId(null);
    setLoadingId(null);
  }, []);

  useEffect(() => stop, [stop]);

  /** Plays a chunk of Hank's text. `id` identifies which message is speaking. */
  const play = useCallback(
    async (id: string, text: string) => {
      if (!text.trim()) return;
      stop();
      setError(null);
      setLoadingId(id);
      try {
        const result = (await speak({ data: { text: text.slice(0, 5000) } })) as Result;
        if (!result.ok || !result.audioBase64) {
          setError(result.message ?? "Hank could not speak that just now.");
          setLoadingId(null);
          return;
        }
        const audio = new Audio(`data:${result.mimeType ?? "audio/mpeg"};base64,${result.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => {
          setPlayingId(null);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setError("That audio would not play on this device.");
          setPlayingId(null);
          audioRef.current = null;
        };
        setLoadingId(null);
        setPlayingId(id);
        await audio.play();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hank could not speak that just now.");
        setLoadingId(null);
        setPlayingId(null);
      }
    },
    [speak, stop],
  );

  return { play, stop, loadingId, playingId, error, clearError: () => setError(null) };
}

/**
 * Wake phrase listening ("Hey Hank") for Voice Mode.
 *
 * Uses the browser's own built-in speech recognition, so the shop's room audio
 * is never streamed to Hank's answering service or his speaking service just to
 * catch his name. Nothing is recorded or kept here: the browser reports words,
 * this hook looks for the phrase, and everything else is thrown away.
 *
 * Deliberately isolated behind one small hook so a future Windows or phone app
 * can swap in a deeper, always-on detector without touching Voice Mode, Hank,
 * his tools or his voice.
 */
import { useEffect, useRef, useState } from "react";

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, RecognitionCtor | undefined>;
  return w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null;
}

export function wakeWordSupported(): boolean {
  return ctor() !== null;
}

/** Loose match: ignores case, punctuation and filler around the phrase. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Options {
  /** Listen only while true — paused while Hank talks or a turn is in flight. */
  active: boolean;
  phrase: string;
  onDetected: () => void;
}

export function useWakeWord(options: Options) {
  const [supported] = useState(() => wakeWordSupported());
  const [error, setError] = useState<string | null>(null);
  const detectedRef = useRef(options.onDetected);
  detectedRef.current = options.onDetected;

  useEffect(() => {
    if (!supported || !options.active) return;
    const Ctor = ctor();
    if (!Ctor) return;

    const target = normalise(options.phrase);
    if (!target) return;

    let stopped = false;
    let seen = "";
    let recognition: Recognition | null = null;
    let restart: ReturnType<typeof setTimeout> | null = null;

    const begin = () => {
      if (stopped) return;
      try {
        recognition = new Ctor();
      } catch {
        setError("This browser cannot listen for a wake phrase.");
        return;
      }
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = navigator.language || "en-US";

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const said = event.results[i]?.[0]?.transcript ?? "";
          // Keep only a short tail, so his name said minutes ago cannot trigger.
          seen = `${seen} ${normalise(said)}`.trim().split(" ").slice(-12).join(" ");
          if (seen.includes(target)) {
            seen = "";
            stopped = true;
            try {
              recognition?.stop();
            } catch {
              /* already stopping */
            }
            detectedRef.current();
            return;
          }
        }
      };
      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          stopped = true;
          setError("The microphone is blocked, so the wake phrase cannot be heard.");
          return;
        }
        if (event.error === "audio-capture") {
          stopped = true;
          setError("No microphone was found for wake phrase listening.");
        }
      };
      recognition.onend = () => {
        // Browsers stop this on their own after a quiet stretch; start it again.
        if (stopped) return;
        restart = setTimeout(begin, 400);
      };

      try {
        recognition.start();
        setError(null);
      } catch {
        restart = setTimeout(begin, 800);
      }
    };

    begin();
    return () => {
      stopped = true;
      if (restart) clearTimeout(restart);
      try {
        recognition?.abort();
      } catch {
        /* nothing to stop */
      }
    };
  }, [supported, options.active, options.phrase]);

  return { supported, error };
}

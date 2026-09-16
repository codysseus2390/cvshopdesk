/**
 * Hank Voice Mode — a spoken conversation with the same Hank.
 *
 * This screen only handles the microphone and the visuals. The words it hears
 * are written down by the server and then sent through the ordinary Hank chat
 * function, so personality, shop data tools, actions, permissions,
 * confirmations, audit logging and the written transcript all behave exactly as
 * they do when the same thing is typed. Speaking back uses the voice saved in
 * Hank Settings.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, MicOff, Square, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transcribeHankSpeech } from "@/lib/voice.functions";
import { HANK_WAKE_ACKS, type HankVoiceInputMode } from "@/lib/ai/voice-config";
import { useWakeWord } from "./use-wake-word";

type Phase = "starting" | "waiting" | "ready" | "listening" | "processing" | "working" | "speaking" | "error";

interface Props {
  assistantName: string;
  /** Hank is composing an answer (may be using tools). */
  busy: boolean;
  /** Hank's answer is being prepared or played. */
  speaking: boolean;
  inputMode: HankVoiceInputMode;
  autoListen: boolean;
  wakePhrase: string;
  wakeSound: boolean;
  wakeResponse: boolean;
  wakeTimeoutSeconds: number;
  /** The last thing Hank said, shown as a short caption. */
  caption: string;
  onSubmit: (text: string) => void;
  /** Speaks a short acknowledgement in Hank's saved voice. */
  onAcknowledge?: (text: string) => void;
  onStopSpeaking: () => void;
  onExit: () => void;
}

/** Short rising chime, made in the browser. No file, no request. */
function chime(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(990, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  } catch {
    /* a missing chime never matters */
  }
}

/** Loudness thresholds (0-1 RMS). Higher while Hank talks, to ignore his voice. */
const SPEECH_LEVEL = 0.045;
const BARGE_LEVEL = 0.12;
const SILENCE_MS = 1_200;
const MIN_SPEECH_MS = 350;
const MAX_CLIP_MS = 30_000;

const PICK_TYPES = ["audio/webm", "audio/mp4", "audio/ogg"];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return PICK_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function VoiceMode(props: Props) {
  const transcribe = useServerFn(transcribeHankSpeech);

  const [phase, setPhase] = useState<Phase>("starting");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const framesRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const speechAtRef = useRef(0);
  const silenceAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const loudSinceRef = useRef(0);
  const phaseRef = useRef<Phase>("starting");
  const mutedRef = useRef(false);
  const holdRef = useRef(false);

  phaseRef.current = phase;
  mutedRef.current = muted;

  const busy = props.busy;
  const speaking = props.speaking;
  const wakeMode = props.inputMode === "wake";


  /* ---------- recording ---------- */

  const stopRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const send = useCallback(
    async (blob: Blob, mimeType: string) => {
      setPhase("processing");
      try {
        const buffer = await blob.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const result = (await transcribe({
          data: { mimeType: mimeType || "audio/webm", audioBase64: btoa(binary) },
        })) as { ok: boolean; text?: string; message?: string };

        if (!result.ok) {
          setError(result.message ?? "That could not be understood.");
          setPhase("ready");
          return;
        }
        const text = (result.text ?? "").trim();
        if (!text) {
          setPhase("ready");
          return;
        }
        setError(null);
        setHeard(text);
        props.onSubmit(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "That could not be understood.");
        setPhase("ready");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transcribe],
  );

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || mutedRef.current) return;
    if (recorderRef.current && recorderRef.current.state === "recording") return;

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      setError("This browser cannot record audio. Voice Mode needs a newer browser.");
      setPhase("error");
      return;
    }
    framesRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) framesRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const frames = framesRef.current;
      framesRef.current = [];
      const spoke = speechAtRef.current > 0 && speechAtRef.current - startedAtRef.current >= 0;
      const long = Date.now() - startedAtRef.current > MIN_SPEECH_MS;
      const blob = new Blob(frames, { type: recorder.mimeType || mimeType || "audio/webm" });
      if (!spoke || !long || blob.size < 1_500) {
        setPhase("ready");
        return;
      }
      void send(blob, recorder.mimeType || mimeType || "audio/webm");
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    speechAtRef.current = 0;
    silenceAtRef.current = 0;
    recorder.start();
    setPhase("listening");
  }, [send]);

  /* ---------- microphone + level loop ---------- */

  useEffect(() => {
    let cancelled = false;

    async function begin() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This device has no microphone support in the browser.");
        setPhase("error");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (err) {
        const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
        setError(
          denied
            ? "Microphone access was blocked. Allow the microphone for this site, then open Voice Mode again."
            : "No microphone was found. Connect a headset or microphone and try again.",
        );
        setPhase("error");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Float32Array(analyser.fftSize);
      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) sum += sample * sample;
        const rms = Math.sqrt(sum / buffer.length);
        setLevel(mutedRef.current ? 0 : Math.min(1, rms * 6));
        if (mutedRef.current) return;
        const now = Date.now();
        const current = phaseRef.current;

        if (current === "listening") {
          if (rms > SPEECH_LEVEL) {
            speechAtRef.current = now;
            silenceAtRef.current = 0;
          } else if (speechAtRef.current > 0) {
            if (silenceAtRef.current === 0) silenceAtRef.current = now;
            if (now - silenceAtRef.current > SILENCE_MS) stopRecorder();
          }
          if (now - startedAtRef.current > MAX_CLIP_MS) stopRecorder();
          return;
        }

        // Barge-in: a clear, sustained voice while Hank talks stops his audio.
        if (current === "speaking") {
          if (rms > BARGE_LEVEL) {
            if (loudSinceRef.current === 0) loudSinceRef.current = now;
            if (now - loudSinceRef.current > 300) {
              loudSinceRef.current = 0;
              props.onStopSpeaking();
            }
          } else {
            loudSinceRef.current = 0;
          }
        }
      };
      setPhase("ready");
      tick();
    }

    void begin();
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void ctxRef.current?.close().catch(() => {});
      streamRef.current = null;
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- phase follows Hank ---------- */

  useEffect(() => {
    if (phase === "error" || phase === "starting") return;
    if (busy) {
      if (phase === "listening") stopRecorder();
      setPhase("working");
      return;
    }
    if (speaking) {
      setPhase("speaking");
      return;
    }
    if (phase === "working" || phase === "speaking") setPhase("ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, speaking]);

  // The conversation loop: whenever nothing else is happening, listen again.
  useEffect(() => {
    if (props.inputMode === "push") return;
    if (!wakeMode && !props.autoListen) return;
    if (phase !== "ready" || muted || busy || speaking) return;
    const timer = setTimeout(() => startRecording(), 250);
    return () => clearTimeout(timer);
  }, [phase, muted, busy, speaking, props.inputMode, props.autoListen, wakeMode, startRecording]);

  /* ---------- wake phrase ---------- */

  // Only listens for the phrase while nothing else is going on, so Hank's own
  // voice can never wake him and ordinary talk mid-conversation is not re-triggered.
  const wake = useWakeWord({
    active: wakeMode && phase === "waiting" && !muted,
    phrase: props.wakePhrase,
    onDetected: () => {
      if (props.wakeSound) chime(ctxRef.current);
      if (props.wakeResponse && props.onAcknowledge) {
        props.onAcknowledge(HANK_WAKE_ACKS[Math.floor(Math.random() * HANK_WAKE_ACKS.length)]!);
      }
      setHeard("");
      setPhase("ready");
    },
  });

  // Wake mode starts out waiting rather than listening.
  useEffect(() => {
    if (wakeMode && phase === "ready" && heard === "" && startedAtRef.current === 0) setPhase("waiting");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeMode, phase]);

  // After a quiet stretch the conversation ends and he waits for the phrase again.
  useEffect(() => {
    if (!wakeMode || phase !== "ready" || busy || speaking) return;
    const timer = setTimeout(() => setPhase("waiting"), Math.max(10, props.wakeTimeoutSeconds) * 1_000);
    return () => clearTimeout(timer);
  }, [wakeMode, phase, busy, speaking, props.wakeTimeoutSeconds]);


  /* ---------- controls ---------- */

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    if (next) stopRecorder();
  }

  function holdStart() {
    if (muted || busy || phase === "error") return;
    holdRef.current = true;
    if (speaking) props.onStopSpeaking();
    speechAtRef.current = Date.now();
    startRecording();
  }

  function holdEnd() {
    if (!holdRef.current) return;
    holdRef.current = false;
    stopRecorder();
  }

  const label: Record<Phase, string> = {
    starting: "Starting the microphone…",
    waiting: muted ? "Microphone muted" : `Say “${props.wakePhrase}” when you need me`,
    ready: muted
      ? "Microphone muted"
      : props.inputMode === "push"
        ? "Hold the microphone to talk"
        : `Ready — just start talking`,
    listening: "Listening…",
    processing: "Writing that down…",
    working: `${props.assistantName} is working…`,
    speaking: `${props.assistantName} is speaking…`,
    error: "Voice Mode had a problem",
  };

  const active = phase === "listening" || phase === "speaking";
  const ring = 1 + (phase === "speaking" ? 0.14 : level * 0.5);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background/98 p-6 backdrop-blur-sm">
      <div className="flex w-full items-start justify-between">
        <div>
          <p className="font-display text-lg font-bold">{props.assistantName}</p>
          <p className="text-xs text-muted-foreground">Voice Mode</p>
          {wakeMode && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${
                  muted || phase === "error" ? "bg-muted-foreground" : "animate-pulse bg-primary"
                }`}
              />
              <span className={muted ? "text-muted-foreground" : "text-primary"}>
                {muted
                  ? "Microphone off"
                  : phase === "waiting"
                    ? `Listening for “${props.wakePhrase}”`
                    : "Microphone on"}
              </span>
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Exit Voice Mode" onClick={props.onExit}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <span
            aria-hidden
            className={`absolute inset-0 rounded-full bg-primary/15 transition-transform duration-150 ${
              active ? "animate-pulse" : ""
            }`}
            style={{ transform: `scale(${ring})` }}
          />
          <span className="absolute inset-6 rounded-full bg-primary/25" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            {phase === "processing" || phase === "working" || phase === "starting" ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : muted ? (
              <MicOff className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </span>
        </div>

        <p aria-live="polite" className="text-center text-sm font-medium text-foreground">
          {label[phase]}
        </p>

        {heard && phase !== "error" && (
          <p className="line-clamp-2 text-center text-xs text-muted-foreground">You said: “{heard}”</p>
        )}
        {props.caption && (phase === "speaking" || phase === "ready") && (
          <p className="line-clamp-3 text-center text-sm text-muted-foreground">{props.caption}</p>
        )}
        {error && (
          <p className="flex items-center gap-2 text-center text-xs font-medium text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" /> {error}
          </p>
        )}
        {wakeMode && !wake.supported && (
          <p className="flex items-center gap-2 text-center text-xs text-muted-foreground">
            <TriangleAlert className="h-3.5 w-3.5" /> This browser cannot listen for a wake phrase. Use Chrome or Edge,
            or just start talking here as usual.
          </p>
        )}
        {wakeMode && wake.error && (
          <p className="flex items-center gap-2 text-center text-xs font-medium text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" /> {wake.error}
          </p>
        )}
      </div>

      <div className="flex w-full max-w-md items-center justify-center gap-3 pb-2">
        <Button variant="outline" className="rounded-full" onClick={toggleMute}>
          {muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
          {muted ? "Unmute" : "Mute"}
        </Button>

        {props.inputMode === "push" && (
          <Button
            className="rounded-full px-6"
            disabled={muted || busy || phase === "error"}
            onPointerDown={holdStart}
            onPointerUp={holdEnd}
            onPointerLeave={holdEnd}
            onPointerCancel={holdEnd}
          >
            <Mic className="mr-2 h-4 w-4" /> {phase === "listening" ? "Release to send" : "Hold to talk"}
          </Button>
        )}

        <Button variant="outline" className="rounded-full" disabled={!speaking} onClick={props.onStopSpeaking}>
          <Square className="mr-2 h-4 w-4" /> Stop {props.assistantName}
        </Button>
        <Button variant="ghost" className="rounded-full" onClick={props.onExit}>
          Exit
        </Button>
      </div>
    </div>
  );
}

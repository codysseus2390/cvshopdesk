/**
 * One spoken message, straight from the chat bar.
 *
 * Records a single clip, has the server write it down with the same
 * transcription function Voice Mode uses, then hands the words to the ordinary
 * Hank chat submit — so personality, tools, permissions, confirmations, audit
 * logging and the written transcript all behave exactly as when typed.
 */
import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transcribeHankSpeech } from "@/lib/voice.functions";

const PICK_TYPES = ["audio/webm", "audio/mp4", "audio/ogg"];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return PICK_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

interface Props {
  disabled?: boolean;
  /** Called with the words that were heard. */
  onResult: (text: string) => void;
  onError: (message: string) => void;
}

export function TalkButton({ disabled, onResult, onError }: Props) {
  const transcribe = useServerFn(transcribeHankSpeech);
  const [state, setState] = useState<"idle" | "listening" | "processing">("idle");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const framesRef = useRef<Blob[]>([]);
  const keepRef = useRef(true);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const finish = useCallback(
    async (blob: Blob, mimeType: string) => {
      if (blob.size < 1_500) {
        setState("idle");
        onError("That recording was empty. Try speaking again.");
        return;
      }
      setState("processing");
      try {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const result = (await transcribe({
          data: { mimeType: mimeType || "audio/webm", audioBase64: btoa(binary) },
        })) as { ok: boolean; text?: string; message?: string };
        setState("idle");
        if (!result.ok) {
          onError(result.message ?? "That could not be understood.");
          return;
        }
        const text = (result.text ?? "").trim();
        if (!text) {
          onError("Nothing was heard in that recording.");
          return;
        }
        onResult(text);
      } catch (err) {
        setState("idle");
        onError(err instanceof Error ? err.message : "That could not be understood.");
      }
    },
    [onError, onResult, transcribe],
  );

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError("This browser cannot use the microphone.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      framesRef.current = [];
      keepRef.current = true;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) framesRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const frames = framesRef.current;
        framesRef.current = [];
        const type = recorder.mimeType || mimeType || "audio/webm";
        cleanup();
        if (!keepRef.current) {
          setState("idle");
          return;
        }
        void finish(new Blob(frames, { type }), type);
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("listening");
    } catch {
      cleanup();
      setState("idle");
      onError("The microphone could not be used. Allow microphone access and try again.");
    }
  }, [cleanup, finish, onError]);

  function stop(keep: boolean) {
    keepRef.current = keep;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else {
      cleanup();
      setState("idle");
    }
  }

  if (state === "processing") {
    return (
      <Button type="button" variant="outline" size="icon" disabled className="h-9 w-9 shrink-0 rounded-full">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="sr-only">Writing that down</span>
      </Button>
    );
  }

  if (state === "listening") {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          size="icon"
          aria-label="Send what I just said"
          title="Done speaking"
          onClick={() => stop(true)}
          className="h-9 w-9 rounded-full bg-primary text-primary-foreground"
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
        <button
          type="button"
          onClick={() => stop(false)}
          className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Talk — speak one message"
      title="Talk"
      disabled={disabled}
      onClick={() => void start()}
      className="h-9 w-9 shrink-0 rounded-full"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
}

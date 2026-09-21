/**
 * The bottom Hank bar, available on every screen.
 *
 * It is a compact door into the SAME Hank as the main Hank screen: the same
 * conversation, server function, personality, tools, permissions, attachments,
 * speech-to-text and Voice Mode. Long answers, pictures and confirmations are
 * shown on the Hank screen, which this bar links to.
 */
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, AudioLines, FileText, TriangleAlert, X } from "lucide-react";
import { sendShopAiMessage } from "@/lib/shop-ai.functions";
import { getAiSettings } from "@/lib/ai-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComposerMenu, CREATE_IMAGE_PREFIX } from "@/components/shop-ai/composer-menu";
import { TalkButton } from "@/components/shop-ai/talk-button";
import { VoiceMode } from "@/components/shop-ai/voice-mode";
import { useHankSpeech } from "@/components/shop-ai/use-hank-speech";
import {
  ACCEPTED_ATTACHMENT_TYPES,
  readAttachment,
  validateAttachment,
  type DraftAttachment,
} from "@/components/shop-ai/attachments";
import { ASSISTANT_DEFAULTS } from "@/lib/ai/model-config";

interface Turn {
  role: "user" | "assistant";
  text: string;
  ok?: boolean;
}

export function AssistantBar() {
  const send = useServerFn(sendShopAiMessage);
  const loadSettings = useServerFn(getAiSettings);
  const queryClient = useQueryClient();

  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [open, setOpen] = useState(false);
  const [attachment, setAttachment] = useState<DraftAttachment | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const { data: config } = useQuery({ queryKey: ["ai-settings"], queryFn: () => loadSettings() });
  const assistantName = config?.settings.assistantName || ASSISTANT_DEFAULTS.name;
  const speech = useHankSpeech();
  const voiceOn = Boolean(config?.voice?.enabled) && Boolean(config?.voiceConfigured);

  const mutation = useMutation({
    mutationFn: (payload: { message: string; attachment: DraftAttachment | null }) =>
      send({
        data: {
          message: payload.message,
          attachments: payload.attachment
            ? [
                {
                  name: payload.attachment.name,
                  mimeType: payload.attachment.mimeType as never,
                  dataUrl: payload.attachment.dataUrl,
                },
              ]
            : [],
        },
      }),
    onSuccess: async (result) => {
      setTurns((t) => [...t, { role: "assistant", text: result.reply, ok: result.ok }]);
      await queryClient.invalidateQueries({ queryKey: ["shop-ai-messages"] });
      if (result.dataChanged) await queryClient.invalidateQueries();
      if (voiceOn && result.ok) void speech.play(`bar-${Date.now()}`, result.reply);
    },
    onError: (err) => {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "That did not work just now.",
          ok: false,
        },
      ]);
    },
  });

  const busy = mutation.isPending;

  async function pickFile(file: File | null) {
    if (!file) return;
    setProblem(null);
    const issue = validateAttachment(file, 0);
    if (issue) {
      setProblem(issue);
      return;
    }
    try {
      setAttachment(await readAttachment(file));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That file could not be read.");
    }
  }

  function submit(text?: string) {
    const q = (text ?? question).trim();
    if (busy) return;
    if (!attachment && q.length < 2) return;
    const outgoing = attachment;
    setQuestion("");
    setAttachment(null);
    setProblem(null);
    setOpen(true);
    setTurns((t) => [
      ...t,
      { role: "user", text: outgoing ? `${outgoing.name}${q ? ` — ${q}` : ""}` : q },
    ]);
    mutation.mutate({ message: q, attachment: outgoing });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-background/80 backdrop-blur-2xl">
      {open && turns.length > 0 && (
        <div className="max-h-64 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={`page-enter ${
                turn.role === "user"
                  ? "text-sm font-semibold text-foreground"
                  : turn.ok === false
                    ? "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                    : "rounded-lg border border-border/70 bg-muted p-3 text-sm text-foreground"
              }`}
            >
              {turn.role === "user" ? `You: ${turn.text}` : turn.text}
            </div>
          ))}
          {busy && <p className="text-sm text-muted-foreground">Working on that…</p>}
          <p className="text-[11px] text-muted-foreground">
            <Link to="/shop-ai" className="underline underline-offset-2">
              Open {assistantName}
            </Link>{" "}
            for pictures, attachments and the full conversation.
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`mx-auto my-3 w-[calc(100%-1.25rem)] max-w-4xl rounded-3xl border border-border/80 bg-card/95 p-2.5 shadow-elevated backdrop-blur-sm transition-shadow duration-300 sm:w-[calc(100%-3rem)] ${busy ? "shadow-[0_0_18px_color-mix(in_oklch,var(--color-primary)_12%,transparent)]" : ""}`}
      >
        {attachment && (
          <div className="mb-2 flex max-w-full items-center gap-2 truncate rounded-full border border-border bg-muted px-3 py-1.5 text-xs">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{attachment.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label="Remove attachment"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {problem && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" /> {problem}
          </p>
        )}

        <div className="flex w-full min-w-0 items-center gap-2">
          <ComposerMenu
            size="lg"
            disabled={busy}
            onAttach={() => fileInput.current?.click()}
            onTakePhoto={() => cameraInput.current?.click()}
            onCreateImage={() => {
              setQuestion(CREATE_IMAGE_PREFIX);
              inputRef.current?.focus();
            }}
          />

          <Input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onPaste={(e) => {
              const file = Array.from(e.clipboardData.files)[0];
              if (file) {
                e.preventDefault();
                void pickFile(file);
              }
            }}
            placeholder={`Ask ${assistantName} about your shop…`}
            aria-label={`Ask ${assistantName}`}
            className="h-12 min-w-0 flex-1 rounded-full border-border/60 bg-muted/50 px-4 shadow-inner transition-shadow focus-visible:shadow-none"
          />

          <TalkButton
            disabled={busy}
            onResult={(text) => submit(text)}
            onError={(message) => setProblem(message)}
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Voice Mode — talk with ${assistantName}`}
            title="Voice Mode"
            onClick={() => setVoiceMode(true)}
            className="h-9 w-9 shrink-0 rounded-full"
          >
            <AudioLines className="h-4 w-4" />
          </Button>

          <Button
            type="submit"
            size="icon"
            className="h-12 w-12 shrink-0 rounded-full shadow-md hover:shadow-lg"
            disabled={busy || (!attachment && question.trim().length < 2)}
            aria-label="Send"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_ATTACHMENT_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            void pickFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void pickFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </form>

      {voiceMode && (
        <VoiceMode
          assistantName={assistantName}
          busy={busy}
          speaking={speech.playingId !== null || speech.loadingId !== null}
          inputMode={
            config?.voice?.wakeEnabled
              ? "wake"
              : config?.voice?.inputMode === "wake"
                ? "auto"
                : (config?.voice?.inputMode ?? "auto")
          }
          autoListen={config?.voice?.autoListen !== false}
          wakePhrase={config?.voice?.wakePhrase?.trim() || "Hey Hank"}
          wakeSound={config?.voice?.wakeSound !== false}
          wakeResponse={Boolean(config?.voice?.wakeResponse)}
          wakeTimeoutSeconds={config?.voice?.wakeTimeoutSeconds ?? 30}
          caption={[...turns].reverse().find((turn) => turn.role === "assistant")?.text ?? ""}
          onSubmit={(text) => submit(text)}
          onAcknowledge={(text) => void speech.play("hank-wake-ack", text)}
          getOutputLevel={speech.getOutputLevel}
          onStopSpeaking={speech.stop}
          onExit={() => {
            speech.stop();
            setVoiceMode(false);
          }}
        />
      )}
    </div>
  );
}

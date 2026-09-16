import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  ImageIcon,
  Loader2,
  Paperclip,
  RotateCcw,
  Send,
  Square,
  TriangleAlert,
  UserRound,
  Volume2,
  AudioLines,
} from "lucide-react";
import { useHankSpeech } from "@/components/shop-ai/use-hank-speech";
import { VoiceMode } from "@/components/shop-ai/voice-mode";
import { AppShell } from "@/components/app-shell";
import { AccessGate } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ThinkingIndicator, ToolActivity, type ToolActivityItem } from "@/components/shop-ai/tool-activity";
import {
  ACCEPTED_ATTACHMENT_TYPES,
  AttachmentStrip,
  readAttachment,
  validateAttachment,
  type DraftAttachment,
} from "@/components/shop-ai/attachments";
import { DetectedCard } from "@/components/shop-ai/detected-card";
import {
  clearShopAiConversation,
  listShopAiMessages,
  sendShopAiMessage,
  type DetectedProposalView,
} from "@/lib/shop-ai.functions";
import { getAiSettings } from "@/lib/ai-settings.functions";
import { SHOP_AI_COUNTER_THRESHOLD, SHOP_AI_MAX_MESSAGE_CHARS, ASSISTANT_DEFAULTS } from "@/lib/ai/model-config";

export const Route = createFileRoute("/_authenticated/shop-ai")({
  head: () => ({
    meta: [
      { title: "Hank — Cedar Valley Hub" },
      {
        name: "description",
        content: "Ask Hank about automotive service, tires and shop operations from inside Cedar Valley Hub.",
      },
      { property: "og:title", content: "Hank — Cedar Valley Hub" },
      { property: "og:description", content: "Cedar Valley shop assistant for service advisors and technicians." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AccessGate>
      <ShopAiPage />
    </AccessGate>
  ),
});

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: ToolActivityItem[];
  failed?: boolean;
  attachments?: { name: string; mimeType: string }[];
  proposals?: DetectedProposalView[];
}

const SUGGESTIONS = [
  "Explain a P0171 lean code to a customer in plain language",
  "Enter today's numbers: gross profit 4,106.22 and 14 cars",
  "Draft a polite text telling a customer their parts are delayed",
];

function ShopAiPage() {
  const fetchMessages = useServerFn(listShopAiMessages);
  const send = useServerFn(sendShopAiMessage);
  const clear = useServerFn(clearShopAiConversation);
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: saved, isLoading } = useQuery({
    queryKey: ["shop-ai-messages"],
    queryFn: () => fetchMessages(),
  });

  const loadSettings = useServerFn(getAiSettings);
  const { data: config } = useQuery({ queryKey: ["ai-settings"], queryFn: () => loadSettings() });
  const assistantName = config?.settings.assistantName || ASSISTANT_DEFAULTS.name;
  const subtitle = config?.settings.subtitle || ASSISTANT_DEFAULTS.subtitle;
  const overLimit = draft.length > SHOP_AI_MAX_MESSAGE_CHARS;

  const messages: ChatMessage[] = [
    ...(saved ?? []).map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      tools: row.tools as ToolActivityItem[],
      attachments: row.attachments,
      proposals: row.proposals as DetectedProposalView[],
    })),
    ...pending,
  ];

  const mutation = useMutation({
    mutationFn: (payload: { message: string; attachments: DraftAttachment[] }) =>
      send({
        data: {
          message: payload.message,
          attachments: payload.attachments.map((file) => ({
            name: file.name,
            mimeType: file.mimeType as never,
            dataUrl: file.dataUrl,
          })),
        },
      }),
    onSuccess: async (result) => {
      if (result.ok) {
        setPending([]);
        await queryClient.invalidateQueries({ queryKey: ["shop-ai-messages"] });
        // A tool changed shop data, so refresh every screen that reads it.
        if (result.dataChanged) await queryClient.invalidateQueries();
      } else {
        setPending((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "assistant", content: result.reply, failed: true },
        ]);
      }
    },
    onError: (err) => {
      setPending((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: err instanceof Error ? err.message : `${assistantName} could not answer just now.`,
          failed: true,
        },
      ]);
    },
  });

  // Only the newest answer still offers Confirm / Edit / Cancel.
  const lastId = messages[messages.length - 1]?.id;
  const isLast = (message: ChatMessage) => message.id === lastId;

  // Voice is a layer on top of the written answer: if it fails, the text stands.
  const speech = useHankSpeech();
  const voiceOn = Boolean(config?.voice?.enabled) && Boolean(config?.voiceConfigured);
  const [voiceMode, setVoiceMode] = useState(false);
  // In Voice Mode every answer is spoken, whatever the auto-speak setting says.
  const autoSpeak = voiceOn && (Boolean(config?.voice?.autoSpeak) || voiceMode);
  const spokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoSpeak) return;
    const last = messages[messages.length - 1];
    // New answers only — never read an old conversation back on open.
    if (!last || last.role !== "assistant" || last.failed) return;
    if (spokenRef.current === null) {
      spokenRef.current = last.id;
      return;
    }
    if (spokenRef.current === last.id) return;
    spokenRef.current = last.id;
    void speech.play(last.id, last.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpeak, lastId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, mutation.isPending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function addFiles(files: File[]) {
    setAttachError(null);
    let accepted = [...attachments];
    for (const file of files) {
      const problem = validateAttachment(file, accepted.length);
      if (problem) {
        setAttachError(problem);
        continue;
      }
      try {
        accepted = [...accepted, await readAttachment(file)];
      } catch (err) {
        setAttachError(err instanceof Error ? err.message : "That file could not be read.");
      }
    }
    setAttachments(accepted);
  }

  function submit(text?: string) {
    const message = (text ?? draft).trim();
    if ((!message && attachments.length === 0) || mutation.isPending) return;
    if (message.length > SHOP_AI_MAX_MESSAGE_CHARS) {
      setAttachError(
        `That message is ${message.length.toLocaleString()} characters. The limit is ${SHOP_AI_MAX_MESSAGE_CHARS.toLocaleString()} — nothing was sent. Shorten it or send it in two parts.`,
      );
      return;
    }
    const outgoing = attachments;
    setDraft("");
    setAttachments([]);
    setAttachError(null);
    setPending([
      {
        id: `u-${Date.now()}`,
        role: "user",
        content: message,
        attachments: outgoing.map((file) => ({ name: file.name, mimeType: file.mimeType })),
      },
    ]);
    mutation.mutate({ message, attachments: outgoing });
    inputRef.current?.focus();
  }

  async function reset() {
    if (mutation.isPending) return;
    setPending([]);
    setAttachments([]);
    setAttachError(null);
    await clear();
    await queryClient.invalidateQueries({ queryKey: ["shop-ai-messages"] });
    inputRef.current?.focus();
  }

  return (
    <AppShell
      title={assistantName}
      subtitle={`${subtitle} — automotive and shop-operations help. It says so when it cannot see a data source.`}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        <div className="mb-3 flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={reset} disabled={mutation.isPending} className="rounded-xl">
            <RotateCcw className="mr-2 h-3.5 w-3.5" /> New conversation
          </Button>
        </div>

        <Card className="min-h-[52vh]">
          <CardContent className="space-y-5 p-4 sm:p-6">
            {isLoading && <p className="text-sm text-muted-foreground">Loading your conversation…</p>}

            {!isLoading && messages.length === 0 && (
              <div className="py-6 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-6 w-6" />
                </span>
                <h2 className="mt-3 font-display text-xl font-bold">How can {assistantName} help?</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Ask about diagnostics, tires, maintenance intervals, customer wording or shop process. It will not
                  guess at customer, inventory or sales records.
                </p>
                <div className="mt-4 grid gap-2 text-left sm:grid-cols-3">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => submit(suggestion)}
                      className="rounded-xl border border-border bg-muted/50 p-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end gap-2">
                  <div className="max-w-[85%] space-y-1.5">
                    <div className="whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                      {message.content}
                    </div>
                    {(message.attachments ?? []).length > 0 && (
                      <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                        <ImageIcon className="h-3 w-3" />
                        {(message.attachments ?? []).map((file) => file.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="mt-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground sm:flex">
                    <UserRound className="h-3.5 w-3.5" />
                  </span>
                </div>
              ) : (
                <div key={message.id} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <ToolActivity items={message.tools} />
                    <div
                      className={
                        message.failed
                          ? "whitespace-pre-wrap rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                          : "whitespace-pre-wrap text-sm leading-relaxed text-foreground"
                      }
                    >
                      {message.content}
                    </div>
                    {voiceOn && !message.failed && message.content.trim().length > 0 && (
                      <div className="mt-1.5 flex items-center gap-2">
                        {speech.playingId === message.id ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-full px-2 text-xs"
                            onClick={speech.stop}
                          >
                            <Square className="mr-1.5 h-3 w-3" /> Stop
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-full px-2 text-xs text-muted-foreground"
                            aria-label={`Read this answer out loud`}
                            disabled={speech.loadingId === message.id}
                            onClick={() => void speech.play(message.id, message.content)}
                          >
                            {speech.loadingId === message.id ? (
                              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            ) : (
                              <Volume2 className="mr-1.5 h-3 w-3" />
                            )}
                            {speech.loadingId === message.id ? "Preparing…" : "Listen"}
                          </Button>
                        )}
                        {speech.error && speech.playingId === null && speech.loadingId === null && isLast(message) && (
                          <span className="text-[11px] text-muted-foreground">{speech.error}</span>
                        )}
                      </div>
                    )}
                    {isLast(message) &&
                      (message.proposals ?? []).map((proposal) => (
                        <DetectedCard
                          key={proposal.id}
                          proposal={proposal}
                          disabled={mutation.isPending}
                          onRespond={(text) => submit(text)}
                        />
                      ))}
                  </div>
                </div>
              ),
            )}

            {mutation.isPending && (
              <div className="flex gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </span>
                <ThinkingIndicator />
              </div>
            )}
            <div ref={endRef} />
          </CardContent>
        </Card>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(Array.from(e.dataTransfer.files));
          }}
          className={`mt-4 rounded-2xl border bg-card p-3 shadow-card transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border/80"
          }`}
        >
          <AttachmentStrip
            items={attachments}
            disabled={mutation.isPending}
            onRemove={(id) => setAttachments((prev) => prev.filter((file) => file.id !== id))}
          />

          {attachError && (
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-destructive">
              <TriangleAlert className="h-3.5 w-3.5" /> {attachError}
            </p>
          )}

          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length > 0) {
                e.preventDefault();
                void addFiles(files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={`Ask ${assistantName}, or paste a screenshot with Ctrl + V… (Shift + Enter for a new line)`}
            rows={3}
            aria-label={`Message ${assistantName}`}
            className="min-h-[76px] resize-none border-transparent bg-muted/60 focus-visible:border-primary/40"
          />

          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPTED_ATTACHMENT_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />

          {draft.length >= SHOP_AI_COUNTER_THRESHOLD && (
            <p
              className={`mt-1 text-right text-[11px] ${overLimit ? "font-medium text-destructive" : "text-muted-foreground"}`}
            >
              {draft.length.toLocaleString()} / {SHOP_AI_MAX_MESSAGE_CHARS.toLocaleString()} characters
            </p>
          )}

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Attach an image or PDF"
                disabled={mutation.isPending}
                onClick={() => fileRef.current?.click()}
                className="h-9 w-9 shrink-0 rounded-full"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <p className="truncate text-[11px] text-muted-foreground">
                Paste or attach screenshots. {assistantName} asks before changing anything already saved.
              </p>
            </div>
            <Button
              type="submit"
              disabled={mutation.isPending || overLimit || (draft.trim().length === 0 && attachments.length === 0)}
              className="rounded-xl"
            >
              <Send className="mr-2 h-4 w-4" /> Send
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

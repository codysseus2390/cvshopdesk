import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bot, ImageIcon, Paperclip, RotateCcw, Send, TriangleAlert, UserRound } from "lucide-react";
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
import { clearShopAiConversation, listShopAiMessages, sendShopAiMessage } from "@/lib/shop-ai.functions";

export const Route = createFileRoute("/_authenticated/shop-ai")({
  head: () => ({
    meta: [
      { title: "Shop AI — Cedar Valley Hub" },
      {
        name: "description",
        content: "Ask Shop AI about automotive service, tires and shop operations from inside Cedar Valley Hub.",
      },
      { property: "og:title", content: "Shop AI — Cedar Valley Hub" },
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
}

const SUGGESTIONS = [
  "Explain a P0171 lean code to a customer in plain language",
  "What tire rotation interval should we recommend for an AWD crossover?",
  "Draft a polite text telling a customer their parts are delayed",
];

function ShopAiPage() {
  const fetchMessages = useServerFn(listShopAiMessages);
  const send = useServerFn(sendShopAiMessage);
  const clear = useServerFn(clearShopAiConversation);
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: saved, isLoading } = useQuery({
    queryKey: ["shop-ai-messages"],
    queryFn: () => fetchMessages(),
  });

  const messages: ChatMessage[] = [
    ...(saved ?? []).map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      tools: row.tools as ToolActivityItem[],
    })),
    ...pending,
  ];

  const mutation = useMutation({
    mutationFn: (message: string) => send({ data: { message } }),
    onSuccess: async (result) => {
      if (result.ok) {
        setPending([]);
        await queryClient.invalidateQueries({ queryKey: ["shop-ai-messages"] });
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
          content: err instanceof Error ? err.message : "Shop AI could not answer just now.",
          failed: true,
        },
      ]);
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, mutation.isPending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(text?: string) {
    const message = (text ?? draft).trim();
    if (!message || mutation.isPending) return;
    setDraft("");
    setPending([{ id: `u-${Date.now()}`, role: "user", content: message }]);
    mutation.mutate(message);
    inputRef.current?.focus();
  }

  async function reset() {
    if (mutation.isPending) return;
    setPending([]);
    await clear();
    await queryClient.invalidateQueries({ queryKey: ["shop-ai-messages"] });
    inputRef.current?.focus();
  }

  return (
    <AppShell
      title="Shop AI"
      subtitle="Automotive and shop-operations help. Shop data sources connect later — it will say when it cannot see them."
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
                <h2 className="mt-3 font-display text-xl font-bold">How can Shop AI help?</h2>
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
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                    {message.content}
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
          className="mt-4 rounded-2xl border border-border/80 bg-card p-3 shadow-card"
        >
          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask Shop AI… (Shift + Enter for a new line)"
            rows={3}
            aria-label="Message Shop AI"
            className="min-h-[76px] resize-none border-transparent bg-muted/60 focus-visible:border-primary/40"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Read-only assistant. It never changes shop records.
            </p>
            <Button type="submit" disabled={mutation.isPending || draft.trim().length === 0} className="rounded-xl">
              <Send className="mr-2 h-4 w-4" /> Send
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

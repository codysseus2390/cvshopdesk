import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, FileText, ImageIcon, Plus, Sparkles, X } from "lucide-react";
import { askAssistant } from "@/lib/assistant.functions";
import { registerImport } from "@/lib/imports.functions";
import { supabase } from "@/integrations/supabase/client";
import { useShopContext } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Turn {
  role: "user" | "assistant";
  text: string;
  ok?: boolean;
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function AssistantBar() {
  const ask = useServerFn(askAssistant);
  const register = useServerFn(registerImport);
  const queryClient = useQueryClient();
  const { data: shopContext } = useShopContext();
  const shopId = shopContext?.shop?.id;

  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);

  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function sendAttachment(file: File) {
    if (!shopId) throw new Error("Your shop access is still loading — try again in a moment.");
    const hash = await sha256(file);
    const path = `${shopId}/${crypto.randomUUID()}/${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("shop-uploads")
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) throw new Error(`The file could not be stored: ${upErr.message}`);
    await register({
      data: {
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || "application/octet-stream",
        file_hash: hash,
        file_size: file.size,
        report_scope: "other",
        period_start: null,
        period_end: null,
        captured_at: null,
      },
    });
    await queryClient.invalidateQueries({ queryKey: ["imports"] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (busy) return;
    if (!attachment && q.length < 2) return;

    const pending = attachment;
    setQuestion("");
    setAttachment(null);
    setOpen(true);
    setBusy(true);
    setTurns((t) => [...t, { role: "user", text: pending ? `${pending.name}${q ? ` — ${q}` : ""}` : q }]);

    try {
      if (pending) {
        await sendAttachment(pending);
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            text: `Saved “${pending.name}”. Open Tools to read it and confirm the numbers before they count.`,
            ok: true,
          },
        ]);
      }
      if (q.length >= 2) {
        const result = await ask({ data: { question: q } });
        setTurns((t) => [...t, { role: "assistant", text: result.reply, ok: result.ok }]);
      }
    } catch (err) {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "That did not work just now.",
          ok: false,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/90 shadow-[0_-8px_30px_var(--card-shadow)] backdrop-blur-xl">
      {open && turns.length > 0 && (
        <div className="max-h-64 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={
                turn.role === "user"
                  ? "text-sm font-semibold text-foreground"
                  : turn.ok === false
                    ? "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                    : "rounded-lg border border-border/70 bg-muted p-3 text-sm text-foreground"
              }
            >
              {turn.role === "user" ? `You: ${turn.text}` : turn.text}
            </div>
          ))}
          {busy && <p className="text-sm text-muted-foreground">Working on that…</p>}
        </div>
      )}

      <form onSubmit={submit} className="mx-auto max-w-5xl px-3 py-3 sm:px-6 sm:py-4">
        {attachment && (
          <div className="mb-2 flex max-w-full items-center gap-2 truncate rounded-full border border-border bg-muted px-3 py-1.5 text-xs shadow-sm">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{attachment.name}</span>
            <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex w-full min-w-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full bg-card"
                aria-label="Add photo, file or create"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-52">
              <DropdownMenuItem onSelect={() => photoInput.current?.click()}>
                <ImageIcon className="mr-2 h-4 w-4" /> Add photo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                <FileText className="mr-2 h-4 w-4" /> Add file
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Create
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to="/entry">Today's numbers entry</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/tools">Report import</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">Announcement</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about saved shop numbers…"
            aria-label="Ask the assistant"
            className="h-11 min-w-0 flex-1 rounded-full border-border bg-background px-4 shadow-sm"
          />

          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full shadow-md"
            disabled={busy || (!attachment && question.trim().length < 2)}
            aria-label="Send"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </div>

        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
        />
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf,image/*"
          className="hidden"
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
        />
      </form>
    </div>
  );
}

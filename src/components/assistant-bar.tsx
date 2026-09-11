import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant } from "@/lib/assistant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Turn {
  role: "user" | "assistant";
  text: string;
  ok?: boolean;
}

export function AssistantBar() {
  const ask = useServerFn(askAssistant);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 2 || busy) return;
    setQuestion("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    setOpen(true);
    setBusy(true);
    try {
      const result = await ask({ data: { question: q } });
      setTurns((t) => [...t, { role: "assistant", text: result.reply, ok: result.ok }]);
    } catch (err) {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "The assistant could not answer just now.",
          ok: false,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      {open && turns.length > 0 && (
        <div className="max-h-64 space-y-3 overflow-y-auto px-6 py-4">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={
                turn.role === "user"
                  ? "text-sm font-semibold text-foreground"
                  : turn.ok === false
                    ? "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                    : "rounded-md bg-muted p-3 text-sm text-foreground"
              }
            >
              {turn.role === "user" ? `You: ${turn.text}` : turn.text}
            </div>
          ))}
          {busy && <p className="text-sm text-muted-foreground">Checking saved shop records…</p>}
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-2 px-6 py-3">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about saved shop numbers, e.g. what was gross profit yesterday?"
          aria-label="Ask the assistant"
        />
        <Button type="submit" disabled={busy}>
          Ask
        </Button>
        <Button asChild variant="outline">
          <Link to="/imports">Upload</Link>
        </Button>
        {turns.length > 0 && (
          <Button type="button" variant="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : "Show"}
          </Button>
        )}
      </form>
    </div>
  );
}

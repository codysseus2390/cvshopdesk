import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createNotification, listNotificationAudience } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { roleLabel } from "@/lib/permissions";

type Audience = "all" | "specific" | "display" | "all_display";

/** Create an in-app announcement for staff, the TV screen, or both. */
export function NotificationComposer({ canSend }: { canSend: boolean }) {
  const send = useServerFn(createNotification);
  const fetchAudience = useServerFn(listNotificationAudience);
  const queryClient = useQueryClient();

  const audienceList = useQuery({
    queryKey: ["notification-audience"],
    queryFn: () => fetchAudience(),
    enabled: canSend,
  });

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [audience, setAudience] = useState<Audience>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setNote(null);
    try {
      const result = await send({
        data: { title: title.trim(), message: message.trim(), priority, audience, userIds: selected },
      });
      setNote({
        ok: true,
        text: `Sent to ${result.recipients} recipient${result.recipients === 1 ? "" : "s"}.`,
      });
      setTitle("");
      setMessage("");
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["display-notifications"] });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Nothing was sent." });
    } finally {
      setBusy(false);
    }
  }

  if (!canSend) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Announcements are sent by the owner and admins. Anything sent to you appears under the bell in the header.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Send an announcement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="note-title">Title</Label>
          <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shop meeting" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note-message">Message</Label>
          <Textarea
            id="note-message"
            value={message}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What everyone needs to know"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="note-audience">Who sees it</Label>
            <select
              id="note-audience"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
            >
              <option value="all">All employees</option>
              <option value="specific">Specific employees</option>
              <option value="display">TV / Display only</option>
              <option value="all_display">Employees + TV / Display</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-priority">Priority</Label>
            <select
              id="note-priority"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">Urgent</option>
            </select>
          </div>
        </div>

        {audience === "specific" && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-semibold">Choose employees</p>
            {(audienceList.data ?? []).map((m) => (
              <label key={m.user_id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(m.user_id)}
                  onCheckedChange={(checked) =>
                    setSelected((prev) =>
                      checked ? [...prev, m.user_id] : prev.filter((id) => id !== m.user_id),
                    )
                  }
                />
                <span>
                  {m.email ?? "Unknown email"} · {roleLabel(m.role)}
                </span>
              </label>
            ))}
            {(audienceList.data?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No approved staff to choose from yet.</p>
            )}
          </div>
        )}

        <Button onClick={submit} disabled={busy || title.trim().length < 2 || message.trim().length < 2}>
          {busy ? "Sending…" : "Send announcement"}
        </Button>
        {note && <p className={`text-sm ${note.ok ? "text-muted-foreground" : "text-destructive"}`}>{note.text}</p>}
        <p className="text-xs text-muted-foreground">
          These are in-app announcements saved in the shop records: employees see them under the bell, and anything
          aimed at the TV stays in the display queue. Phone push notifications can be added later without redoing this.
        </p>
      </CardContent>
    </Card>
  );
}

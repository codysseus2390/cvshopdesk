import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Monitor, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/components/use-permissions";
import {
  createNotification,
  listShopAnnouncements,
  removeDisplayNotification,
  updateDisplayNotification,
} from "@/lib/notifications.functions";

type TvNotification = Awaited<ReturnType<typeof listShopAnnouncements>>[number];
type Destination = "display" | "all_display" | "all";
type Priority = "low" | "normal" | "high";

export function TvNotificationPanel() {
  const { isAdmin: canManage } = usePermissions();
  const fetchAnnouncements = useServerFn(listShopAnnouncements);
  const create = useServerFn(createNotification);
  const update = useServerFn(updateDisplayNotification);
  const remove = useServerFn(removeDisplayNotification);
  const queryClient = useQueryClient();
  const queue = useQuery({
    queryKey: ["shop-announcements"],
    queryFn: () => fetchAnnouncements(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
  });
  const allItems = queue.data ?? [];
  const items = allItems.slice(0, 3);

  const [editorOpen, setEditorOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState<TvNotification | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [destination, setDestination] = useState<Destination>("display");
  const [removeTarget, setRemoveTarget] = useState<TvNotification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addMessage() {
    setEditing(null);
    setTitle("");
    setMessage("");
    setPriority("normal");
    setDestination("display");
    setError(null);
    setEditorOpen(true);
  }

  function editMessage(item: TvNotification) {
    if (!item.on_tv) return;
    setEditing(item);
    setTitle(item.notification.title);
    setMessage(item.notification.message);
    setPriority(item.notification.priority as Priority);
    setError(null);
    setEditorOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (editing?.notification) {
        await update({
          data: { notificationId: editing.notification.id, title, message, priority },
        });
        await queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
      } else {
        await create({
          data: {
            title: title.trim(),
            message: message.trim(),
            priority,
            audience: destination,
            userIds: [],
          },
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shop-announcements"] }),
        queryClient.invalidateQueries({ queryKey: ["display-notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["my-notifications"] }),
      ]);
      setEditorOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The TV announcement could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMessage() {
    if (!canManage || !removeTarget || busy) return;
    setBusy(true);
    setError(null);
    try {
      await remove({ data: { recipientId: removeTarget.id } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shop-announcements"] }),
        queryClient.invalidateQueries({ queryKey: ["display-notifications"] }),
      ]);
      setRemoveTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The TV announcement could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="card-lift min-w-0 rounded-2xl border-border/90 bg-card shadow-card panel-glow-ember">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <CardTitle className="flex items-center gap-2 font-body text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground">
            <Bell className="h-4 w-4" />
          </span>
          Announcements
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => setHistoryOpen(true)}>
            History
          </Button>
          {canManage && (
            <Button size="sm" className="h-8 rounded-lg" onClick={addMessage}>
              <Plus className="mr-1 h-4 w-4" /> Add message
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-[252px] flex-col px-4 py-3">
        {queue.isLoading && (
          <p className="py-5 text-sm text-muted-foreground">Loading announcements…</p>
        )}
        {queue.isError && (
          <p role="alert" className="py-5 text-sm text-destructive">
            Announcements could not be loaded.
          </p>
        )}
        {!queue.isLoading && !queue.isError && items.length === 0 && (
          <p className="flex-1 py-5 text-sm text-muted-foreground">
            No announcements yet. {canManage ? "Add a message to show one." : ""}
          </p>
        )}
        {items.length > 0 && (
          <div className="max-h-56 min-h-0 flex-1 overflow-y-auto" aria-label="Recent announcements">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 border-b border-border/70 py-3 last:border-0"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Bell className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold">{item.notification?.title}</p>
                    {item.notification?.priority === "high" && (
                      <Badge variant="destructive">Urgent</Badge>
                    )}
                    <Badge variant="secondary">
                      {item.on_tv ? (item.notification.audience === "all_display" ? "TV + dashboard" : "TV") : item.notification.audience === "display" ? "Removed from TV" : "Dashboard"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {item.notification?.message}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.notification?.created_at
                      ? new Date(item.notification.created_at).toLocaleString()
                      : ""}
                  </p>
                </div>
                {canManage && item.on_tv && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Edit ${item.notification?.title ?? "TV message"}`}
                      onClick={() => editMessage(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={`Remove ${item.notification?.title ?? "TV message"} from TV`}
                      onClick={() => {
                        setError(null);
                        setRemoveTarget(item);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {error && !editorOpen && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
          <span className="text-xs text-muted-foreground">TV shows its two newest messages.</span>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link to="/tv">
              <Monitor className="mr-1.5 h-3.5 w-3.5" /> Open TV mode
            </Link>
          </Button>
        </div>
      </CardContent>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!busy) setEditorOpen(open);
        }}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit TV message" : "Add announcement"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tv-message-title">Title</Label>
              <Input
                id="tv-message-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={2}
                maxLength={140}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tv-message-body">Message</Label>
              <Textarea
                id="tv-message-body"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                minLength={2}
                maxLength={2000}
                rows={4}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tv-message-priority">Priority</Label>
              <select
                id="tv-message-priority"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">Urgent</option>
              </select>
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="announcement-destination">Send to</Label>
                <select id="announcement-destination" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={destination} onChange={(event) => setDestination(event.target.value as Destination)}>
                  <option value="display">TV only</option>
                  <option value="all_display">TV and dashboard</option>
                  <option value="all">Dashboard only</option>
                </select>
              </div>
            )}
            {editing?.notification?.audience === "all_display" && (
              <p className="text-xs text-muted-foreground">
                This message was also sent to staff. Edits will update their copies too.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditorOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || title.trim().length < 2 || message.trim().length < 2}
              >
                {busy ? "Saving…" : editing ? "Save changes" : "Send announcement"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Announcement history</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {queue.isLoading && <p className="py-4 text-sm text-muted-foreground">Loading announcements…</p>}
            {queue.isError && <p role="alert" className="py-4 text-sm text-destructive">Announcements could not be loaded.</p>}
            {!queue.isLoading && !queue.isError && allItems.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No announcements yet.</p>
            )}
            {allItems.map((item) => (
              <div key={item.notification.id} className="border-b border-border/70 py-3 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{item.notification.title}</p>
                  <Badge variant="secondary">
                    {item.on_tv ? (item.notification.audience === "all_display" ? "TV + dashboard" : "TV") : item.notification.audience === "display" ? "Removed from TV" : "Dashboard"}
                  </Badge>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.notification.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(item.notification.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100%-1.5rem)] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from TV?</AlertDialogTitle>
            <AlertDialogDescription>
              “{removeTarget?.notification?.title}” will leave the TV queue. Any copies already sent
              to staff will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void removeMessage();
              }}
              disabled={busy}
            >
              {busy ? "Removing…" : "Remove from TV"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

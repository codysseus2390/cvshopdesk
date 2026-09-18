import { useState } from "react";
import { Bell, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyNotifications, markNotificationRead } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { NotificationComposer } from "@/components/notification-composer";
import { usePermissions } from "@/components/use-permissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function useMyNotifications() {
  const fetchNotifications = useServerFn(listMyNotifications);
  return useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => fetchNotifications(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
  });
}

export function NotificationBell() {
  const { data } = useMyNotifications();
  const markRead = useServerFn(markNotificationRead);
  const queryClient = useQueryClient();
  const items = data ?? [];
  const unread = items.filter((item) => !item.read_at).length;
  const { isAdmin } = usePermissions();
  const [composerOpen, setComposerOpen] = useState(false);

  async function open(recipientId: string, alreadyRead: boolean) {
    if (alreadyRead) return;
    await markRead({ data: { recipientId } });
    await queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative rounded-full bg-card"
            aria-label="Announcements"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                {unread}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[calc(100vw-2rem)] max-w-80 overflow-hidden rounded-xl p-0 shadow-elevated"
        >
          <div className="border-b border-border bg-muted/60 px-4 py-3">
            <p className="font-display text-base font-semibold">Announcements</p>
            {isAdmin && (
              <Button
                className="mt-2 w-full justify-start"
                size="sm"
                onClick={() => setComposerOpen(true)}
              >
                <Send className="h-4 w-4" /> New announcement
              </Button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Nothing has been sent to you yet.
              </p>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => open(item.id, Boolean(item.read_at))}
                className={`block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted ${
                  item.read_at ? "" : "bg-primary/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {item.notification?.title ?? "Announcement"}
                  </span>
                  {item.notification?.priority === "high" && (
                    <Badge variant="destructive">Urgent</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.notification?.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {item.notification?.created_at
                    ? new Date(item.notification.created_at).toLocaleString()
                    : ""}
                  {item.read_at ? "" : " · new"}
                </p>
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display">New announcement</DialogTitle>
          </DialogHeader>
          <NotificationComposer canSend={isAdmin} />
        </DialogContent>
      </Dialog>
    </>
  );
}

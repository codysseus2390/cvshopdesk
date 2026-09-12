import { Bell } from "lucide-react";
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

  async function open(recipientId: string, alreadyRead: boolean) {
    if (alreadyRead) return;
    await markRead({ data: { recipientId } });
    await queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Announcements">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold">Announcements</div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">Nothing has been sent to you yet.</p>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => open(item.id, Boolean(item.read_at))}
              className={`block w-full border-b border-border px-3 py-3 text-left last:border-0 ${
                item.read_at ? "" : "bg-muted/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{item.notification?.title ?? "Announcement"}</span>
                {item.notification?.priority === "high" && <Badge variant="destructive">Urgent</Badge>}
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
  );
}

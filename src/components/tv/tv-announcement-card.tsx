import { Megaphone } from "lucide-react";

export interface TvAnnouncement {
  id: string;
  notification: { title: string; message: string; priority: string } | null;
}

/** A staff announcement, restyled to the same raised-panel system as the rest of TV Mode. */
export function TvAnnouncementCard({ item }: { item: TvAnnouncement }) {
  const high = item.notification?.priority === "high";
  return (
    <div className="tv-announcement" data-priority={high ? "high" : "normal"}>
      <span className="tv-announcement-icon" aria-hidden="true">
        <Megaphone />
      </span>
      <div className="tv-announcement-body">
        <p className="tv-announcement-title">{item.notification?.title}</p>
        <p className="tv-announcement-message">{item.notification?.message}</p>
      </div>
    </div>
  );
}

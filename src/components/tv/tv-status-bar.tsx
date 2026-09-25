import { CircleCheck, Clock, Wrench } from "lucide-react";
import type { TvBoardJob } from "@/lib/tv-board";
import { TvNextAppointment } from "./tv-next-appointment";

export function TvStatusBar({
  inShop,
  upcoming,
  done,
  nextAppointment,
  timezone,
}: {
  inShop: number;
  upcoming: number;
  done: number;
  nextAppointment: TvBoardJob | null;
  timezone: string;
}) {
  return (
    <footer className="tv-footer">
      <div className="tv-footer-totals">
        {[
          {
            status: "in_shop",
            count: inShop,
            title: "In shop",
            caption: "Vehicles being serviced",
            Icon: Wrench,
          },
          {
            status: "upcoming",
            count: upcoming,
            title: "Upcoming",
            caption: "Next in line",
            Icon: Clock,
          },
          {
            status: "done",
            count: done,
            title: "Done",
            caption: "Completed today",
            Icon: CircleCheck,
          },
        ].map(({ status, count, title, caption, Icon }) => (
          <div className="tv-footer-stat" data-status={status} key={status}>
            <span className="tv-ring-icon">
              <Icon aria-hidden="true" />
            </span>
            <strong>{count}</strong>
            <div>
              <p>{title}</p>
              <span>{caption}</span>
            </div>
          </div>
        ))}
      </div>
      <TvNextAppointment appointment={nextAppointment} timezone={timezone} />
    </footer>
  );
}

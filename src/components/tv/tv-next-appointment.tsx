import type { CSSProperties } from "react";
import { tvTime, type TvBoardJob } from "@/lib/tv-board";
import { serviceAccentColor } from "@/lib/service-accent";

/**
 * Bottom-right footer slot. Replaces the old static tagline with the next
 * appointment still ahead today — the same real schedule data as the shop
 * screen, just the single soonest entry that hasn't checked in or closed.
 */
export function TvNextAppointment({
  appointment,
  timezone,
}: {
  appointment: TvBoardJob | null;
  timezone: string;
}) {
  const accent = appointment ? serviceAccentColor(appointment.requested_service) : null;

  return (
    <div
      className="tv-next-appointment"
      style={accent ? ({ "--tv-service-accent": accent } as CSSProperties) : undefined}
    >
      <p className="tv-next-appointment-label">Next appointment</p>
      {appointment ? (
        <>
          <p className="tv-next-appointment-time">{tvTime(appointment.appointment_at, timezone)}</p>
          <p className="tv-next-appointment-customer">
            {appointment.customer_name ?? "Customer not recorded"}
          </p>
          {appointment.vehicle_label && (
            <p className="tv-next-appointment-detail">{appointment.vehicle_label}</p>
          )}
          {appointment.requested_service && (
            <p className="tv-next-appointment-detail">{appointment.requested_service}</p>
          )}
        </>
      ) : (
        <p className="tv-next-appointment-empty">No more appointments today</p>
      )}
    </div>
  );
}

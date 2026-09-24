import { CircleCheck, Clock, Wrench } from "lucide-react";
export function TvNumbersFooter({
  inShop,
  upcoming,
  done,
  nextAppointment,
}: {
  inShop: number;
  upcoming: number;
  done: number;
  nextAppointment: string | null;
}) {
  const items = [
    {
      label: "In shop",
      description: "Vehicles being serviced",
      value: inShop,
      Icon: Wrench,
      tone: "orange",
    },
    { label: "Upcoming", description: "Next in line", value: upcoming, Icon: Clock, tone: "blue" },
    {
      label: "Done",
      description: "Completed today",
      value: done,
      Icon: CircleCheck,
      tone: "green",
    },
  ];
  return (
    <footer className="tv-numbers-footer">
      <div className="tv-numbers-status">
        {items.map(({ label, description, value, Icon, tone }) => (
          <div className={`tv-numbers-status-item tv-status-${tone}`} key={label}>
            <span className="tv-number-icon">
              <Icon aria-hidden="true" />
            </span>
            <strong>{value}</strong>
            <span className="tv-status-copy">
              <b>{label}</b>
              <span>{description}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="tv-numbers-signoff">
        <p>
          {nextAppointment ? `Next appointment — ${nextAppointment}` : "No upcoming appointment"}
        </p>
        <p>Drive confident</p>
      </div>
    </footer>
  );
}

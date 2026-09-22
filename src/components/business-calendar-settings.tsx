import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { saveBusinessCalendar } from "@/lib/admin.functions";
import { usePermissions } from "./use-permissions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function BusinessCalendarSettings() {
  const { settings, isOwner } = usePermissions();
  const calendar = settings?.business_calendar;
  const save = useServerFn(saveBusinessCalendar);
  const queries = useQueryClient();
  const [effective, setEffective] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [exceptionDate, setExceptionDate] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function update(kind: "schedule" | "exception") {
    setBusy(true);
    setMessage("");
    try {
      const schedules = calendar?.schedules ?? [];
      const exceptions = calendar?.exceptions ?? [];
      await save({
        data: {
          schedules:
            kind === "schedule"
              ? [
                  ...schedules.filter((s) => s.effective_from !== effective),
                  { effective_from: effective, open_weekdays: weekdays },
                ]
              : schedules,
          exceptions:
            kind === "exception"
              ? [
                  ...exceptions.filter((e) => e.business_date !== exceptionDate),
                  { business_date: exceptionDate, is_open: isOpen, reason },
                ]
              : exceptions,
        },
      });
      await Promise.all(
        ["admin-config", "dashboard", "numbers"].map((key) =>
          queries.invalidateQueries({ queryKey: [key] }),
        ),
      );
      setMessage("Calendar saved. The change is recorded in the activity log.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Calendar could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Business calendar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Closed days do not count as missing reports or toward goal pacing. Real entries on closed
          days are retained. Holidays must be entered explicitly.
        </p>
        {!calendar && (
          <p>No calendar has been configured. The owner must set one before viewing reports.</p>
        )}
        {calendar?.schedules.map((s) => (
          <p key={s.effective_from} className="text-sm">
            From {s.effective_from}:{" "}
            {s.open_weekdays
              .map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day])
              .join(", ") || "Closed every day"}
          </p>
        ))}
        {isOwner && (
          <>
            <fieldset disabled={busy} className="space-y-3">
              <legend className="font-semibold">Add or replace an effective schedule</legend>
              <label className="block text-sm">
                Effective from
                <Input
                  type="date"
                  value={effective}
                  onChange={(e) => setEffective(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                  <label key={day} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={weekdays.includes(index)}
                      onChange={(e) =>
                        setWeekdays((days) =>
                          e.target.checked ? [...days, index] : days.filter((d) => d !== index),
                        )
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
              <Button disabled={!effective} onClick={() => void update("schedule")}>
                Save schedule
              </Button>
            </fieldset>
            <fieldset disabled={busy || !calendar} className="space-y-3">
              <legend className="font-semibold">Date exception</legend>
              <label className="block text-sm">
                Date
                <Input
                  type="date"
                  value={exceptionDate}
                  onChange={(e) => setExceptionDate(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) => setIsOpen(e.target.checked)}
                />
                Open on this date
              </label>
              <label className="block text-sm">
                Reason
                <Input value={reason} maxLength={140} onChange={(e) => setReason(e.target.value)} />
              </label>
              <Button disabled={!exceptionDate || !reason} onClick={() => void update("exception")}>
                Save exception
              </Button>
            </fieldset>
          </>
        )}
        {calendar?.exceptions.map((e) => (
          <p className="text-sm" key={e.business_date}>
            {e.business_date}: {e.is_open ? "Open" : "Closed"} — {e.reason}
          </p>
        ))}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

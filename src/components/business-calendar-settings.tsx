import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { saveBusinessCalendar } from "@/lib/admin.functions";
import { addDays } from "@/lib/numbers-math";
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
  // Set only when the server reports `{ ok: false, requiresRetroactiveConfirmation: true }`
  // for the in-progress save — never derived from error-message text.
  const [pendingConfirm, setPendingConfirm] = useState<"schedule" | "exception" | null>(null);

  async function update(kind: "schedule" | "exception", confirmRetroactive = false) {
    setBusy(true);
    setMessage("");
    try {
      const schedules = calendar?.schedules ?? [];
      const exceptions = calendar?.exceptions ?? [];
      const result = await save({
        data: {
          calendar: {
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
          confirmRetroactive,
        },
      });
      if (!result.ok) {
        setPendingConfirm(kind);
        setMessage(
          `This change would alter the recorded open/closed status of ${result.conflictDate}, which is on or before today (${result.today}). Confirm to save it anyway, or cancel and adjust the change.`,
        );
        return;
      }
      setPendingConfirm(null);
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
        {[...(calendar?.schedules ?? [])]
          .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
          .map((s, i, sorted) => {
            const previous = sorted[i - 1];
            return (
              <p key={s.effective_from} className="text-sm">
                From {s.effective_from}{" "}
                {i === 0 || !previous ? "(current)" : `to ${addDays(previous.effective_from, -1)}`}:{" "}
                {s.open_weekdays
                  .map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day])
                  .join(", ") || "Closed every day"}
              </p>
            );
          })}
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
              {calendar?.schedules.some((s) => s.effective_from === effective) && (
                <p className="text-sm text-muted-foreground">
                  A schedule already exists for {effective} — saving will replace it.
                </p>
              )}
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
              {calendar?.exceptions.some((e) => e.business_date === exceptionDate) && (
                <p className="text-sm text-muted-foreground">
                  An exception already exists for {exceptionDate} — saving will replace it.
                </p>
              )}
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
        {pendingConfirm && (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void update(pendingConfirm, true)}
            >
              Confirm retroactive change
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setPendingConfirm(null)}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

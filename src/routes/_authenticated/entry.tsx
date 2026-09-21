import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { saveMetricEntry } from "@/lib/metrics.functions";
import {
  getMechanicProductivityEntry,
  saveMechanicProductivityEntry,
} from "@/lib/numbers.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate } from "@/components/access-gate";
import { useDashboard } from "./hub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount, formatCurrency } from "@/lib/metrics-math";
import { formatProductivity } from "@/lib/productivity-math";
import { MECHANICS, type MechanicName } from "@/lib/mechanics";

export const Route = createFileRoute("/_authenticated/entry")({
  head: () => ({
    meta: [
      { title: "Daily entry — Cedar Valley Hub" },
      {
        name: "description",
        content: "Enter and confirm Cedar Valley daily, month-to-date or year-to-date numbers.",
      },
      { property: "og:title", content: "Daily entry — Cedar Valley Hub" },
      { property: "og:description", content: "Enter and confirm shop numbers by hand." },
    ],
  }),
  component: () => (
    <AccessGate>
      <EntryPage />
    </AccessGate>
  ),
});

type Draft = {
  business_date: string;
  scope: "daily" | "mtd" | "ytd";
  sales: string;
  gross_profit: string;
  tires_sold: string;
  car_count: string;
  note: string;
  correction_note: string;
};

type MechanicDraft = Record<
  MechanicName,
  { previous_day: string; weekly: string; monthly: string }
>;

const blankMechanics = (): MechanicDraft =>
  Object.fromEntries(
    MECHANICS.map((technician) => [technician, { previous_day: "", weekly: "", monthly: "" }]),
  ) as MechanicDraft;

function EntryPage() {
  const dashboard = useDashboard();
  const save = useServerFn(saveMetricEntry);
  const fetchMechanics = useServerFn(getMechanicProductivityEntry);
  const saveMechanics = useServerFn(saveMechanicProductivityEntry);
  const queryClient = useQueryClient();
  const today = dashboard.data?.today ?? "";

  const [draft, setDraft] = useState<Draft>({
    business_date: today,
    scope: "daily",
    sales: "",
    gross_profit: "",
    tires_sold: "",
    car_count: "",
    note: "",
    correction_note: "",
  });
  const [stage, setStage] = useState<"edit" | "review">("edit");
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mechanicDraft, setMechanicDraft] = useState<MechanicDraft>(blankMechanics);
  const [mechanicStage, setMechanicStage] = useState<"edit" | "review">("edit");
  const [mechanicSaved, setMechanicSaved] = useState<string | null>(null);
  const [mechanicProblem, setMechanicProblem] = useState<string | null>(null);
  const [mechanicBusy, setMechanicBusy] = useState(false);

  const date = draft.business_date || today;
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const gp = num(draft.gross_profit);
  const cars = num(draft.car_count);
  const invalid =
    [draft.sales, draft.gross_profit, draft.tires_sold, draft.car_count].some(
      (v) => v.trim() !== "" && !Number.isFinite(Number(v)),
    ) || !/^\d{4}-\d{2}-\d{2}$/.test(date);

  const existing = dashboard.data?.recent.find(
    (r) => r.business_date === date && r.scope === draft.scope,
  );
  const mechanicDate = dashboard.data?.previousDay ?? "";
  const mechanicPeriodAnchor = dashboard.data?.today ?? "";
  const mechanicQuery = useQuery({
    queryKey: ["mechanic-entry", mechanicDate, mechanicPeriodAnchor],
    queryFn: () =>
      fetchMechanics({ data: { previous_day: mechanicDate, period_anchor: mechanicPeriodAnchor } }),
    enabled:
      /^\d{4}-\d{2}-\d{2}$/.test(mechanicDate) && /^\d{4}-\d{2}-\d{2}$/.test(mechanicPeriodAnchor),
    staleTime: 0,
  });

  useEffect(() => {
    if (!mechanicQuery.data) return;
    const next = blankMechanics();
    for (const row of mechanicQuery.data as {
      technician: MechanicName;
      business_date: string;
      period_scope: string | null;
      productivity_pct: number | null;
    }[]) {
      if (!(row.technician in next)) continue;
      const field: "previous_day" | "weekly" | "monthly" =
        row.period_scope === "weekly"
          ? "weekly"
          : row.period_scope === "monthly"
            ? "monthly"
            : "previous_day";
      next[row.technician][field] =
        row.productivity_pct === null ? "" : String(row.productivity_pct);
    }
    setMechanicDraft(next);
    setMechanicStage("edit");
  }, [mechanicQuery.data]);

  const mechanicNum = (value: string) => (value.trim() === "" ? null : Number(value));
  const mechanicValues = MECHANICS.map((technician) => ({
    technician,
    previous_day: mechanicNum(mechanicDraft[technician].previous_day),
    weekly: mechanicNum(mechanicDraft[technician].weekly),
    monthly: mechanicNum(mechanicDraft[technician].monthly),
  }));
  const mechanicInvalid = mechanicValues.some((entry) =>
    [entry.previous_day, entry.weekly, entry.monthly].some(
      (value) => value !== null && (!Number.isFinite(value) || value < 0 || value > 100),
    ),
  );

  async function confirmSave() {
    setBusy(true);
    setProblem(null);
    setSaved(null);
    try {
      const result = await save({
        data: {
          business_date: date,
          scope: draft.scope,
          sales: num(draft.sales),
          gross_profit: gp,
          tires_sold: num(draft.tires_sold),
          car_count: cars,
          note: draft.note || undefined,
          correction_note: draft.correction_note || undefined,
        },
      });
      setSaved(
        `Saved to the shop records${result.flags.length ? ` — flagged: ${result.flags.join(", ")}` : ""}.`,
      );
      setStage("edit");
      await queryClient.invalidateQueries();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "The entry was not saved.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmMechanicSave() {
    setMechanicBusy(true);
    setMechanicProblem(null);
    setMechanicSaved(null);
    try {
      await saveMechanics({
        data: {
          previous_day: mechanicDate,
          period_anchor: mechanicPeriodAnchor,
          entries: mechanicValues,
        },
      });
      setMechanicSaved(`Mechanic production saved for ${mechanicDate}.`);
      setMechanicStage("edit");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({
        queryKey: ["mechanic-entry", mechanicDate, mechanicPeriodAnchor],
      });
    } catch (err) {
      setMechanicProblem(err instanceof Error ? err.message : "Mechanic production was not saved.");
    } finally {
      setMechanicBusy(false);
    }
  }

  return (
    <AppShell
      title="Daily entry"
      subtitle="Manual numbers are saved with the business date, scope and your account."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 to-secondary/40" />
          <CardHeader>
            <p className="eyebrow">Manual entry</p>
            <CardTitle className="font-display text-xl">Enter numbers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Business date (shop day)</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDraft({ ...draft, business_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scope">Report scope</Label>
                <select
                  id="scope"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={draft.scope}
                  onChange={(e) => setDraft({ ...draft, scope: e.target.value as Draft["scope"] })}
                >
                  <option value="daily">Daily total for that day</option>
                  <option value="mtd">Month-to-date total</option>
                  <option value="ytd">Year-to-date total</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label="Sales ($)"
                value={draft.sales}
                onChange={(v) => setDraft({ ...draft, sales: v })}
              />
              <Field
                label="Gross profit ($)"
                value={draft.gross_profit}
                onChange={(v) => setDraft({ ...draft, gross_profit: v })}
              />
              <Field
                label="Tires sold"
                value={draft.tires_sold}
                onChange={(v) => setDraft({ ...draft, tires_sold: v })}
              />
              <Field
                label="Car count"
                value={draft.car_count}
                onChange={(v) => setDraft({ ...draft, car_count: v })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave a box empty when the number is not known — it stays "Not updated" instead of
              counting as zero.
            </p>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </div>
            {existing && (
              <div className="space-y-2 rounded-md border border-border bg-muted p-3">
                <p className="text-sm font-semibold">
                  A confirmed record already exists for {date} ({draft.scope}).
                </p>
                <p className="text-xs text-muted-foreground">
                  Current: {formatCurrency(existing.gross_profit)} GP ·{" "}
                  {formatCount(existing.tires_sold)} tires · {formatCount(existing.car_count)} cars.
                  Saving replaces it and keeps the old value in the correction history.
                </p>
                <Label htmlFor="reason">Reason for the correction</Label>
                <Input
                  id="reason"
                  value={draft.correction_note}
                  onChange={(e) => setDraft({ ...draft, correction_note: e.target.value })}
                />
              </div>
            )}
            <Button disabled={invalid} onClick={() => setStage("review")}>
              Review before saving
            </Button>
            {invalid && (
              <p className="text-sm text-destructive">
                Check the date and that every number is numeric.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Review</p>
            <CardTitle className="font-display text-xl">Review and confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stage === "edit" && !saved && (
              <p className="text-sm text-muted-foreground">
                Fill the form, then review here before anything is saved.
              </p>
            )}
            {stage === "review" && (
              <>
                <ul className="space-y-1 text-sm">
                  <li>
                    <strong>Business date:</strong> {date}
                  </li>
                  <li>
                    <strong>Scope:</strong> {draft.scope}
                  </li>
                  <li>
                    <strong>Sales:</strong> {formatCurrency(num(draft.sales))}
                  </li>
                  <li>
                    <strong>Gross profit:</strong> {formatCurrency(gp)}
                  </li>
                  <li>
                    <strong>Tires sold:</strong> {formatCount(num(draft.tires_sold))}
                  </li>
                  <li>
                    <strong>Car count:</strong> {formatCount(cars)}
                  </li>
                </ul>
                <div className="flex gap-2">
                  <Button onClick={confirmSave} disabled={busy}>
                    {busy ? "Saving…" : "Confirm and save"}
                  </Button>
                  <Button variant="outline" onClick={() => setStage("edit")}>
                    Back
                  </Button>
                </div>
              </>
            )}
            {saved && <p className="rounded-md bg-accent/20 p-3 text-sm font-semibold">{saved}</p>}
            {problem && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{problem}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary/60 to-primary/40" />
          <CardHeader>
            <p className="eyebrow">Production</p>
            <CardTitle className="font-display text-xl">Mechanic production</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the production percentage for the previous day, current week, and current month.
            </p>
            <p className="rounded-md bg-muted p-3 text-sm font-semibold">
              Previous day: {mechanicDate || "Loading…"} · Weekly and monthly use the current
              periods
            </p>
            {MECHANICS.map((technician) => (
              <div key={technician} className="space-y-3 rounded-md border border-border p-3">
                <p className="font-semibold">{technician}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field
                    label="Previous day %"
                    value={mechanicDraft[technician].previous_day}
                    onChange={(value) =>
                      setMechanicDraft({
                        ...mechanicDraft,
                        [technician]: { ...mechanicDraft[technician], previous_day: value },
                      })
                    }
                  />
                  <Field
                    label="Weekly %"
                    value={mechanicDraft[technician].weekly}
                    onChange={(value) =>
                      setMechanicDraft({
                        ...mechanicDraft,
                        [technician]: { ...mechanicDraft[technician], weekly: value },
                      })
                    }
                  />
                  <Field
                    label="Monthly %"
                    value={mechanicDraft[technician].monthly}
                    onChange={(value) =>
                      setMechanicDraft({
                        ...mechanicDraft,
                        [technician]: { ...mechanicDraft[technician], monthly: value },
                      })
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              disabled={mechanicInvalid || !/^\d{4}-\d{2}-\d{2}$/.test(mechanicDate)}
              onClick={() => setMechanicStage("review")}
            >
              Review mechanic production
            </Button>
            {mechanicInvalid && (
              <p className="text-sm text-destructive">Enter percentages from 0 to 100.</p>
            )}
            {mechanicQuery.error && (
              <p className="text-sm text-destructive">
                {mechanicQuery.error instanceof Error
                  ? mechanicQuery.error.message
                  : "Could not load mechanic production."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Review</p>
            <CardTitle className="font-display text-xl">Review mechanic production</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mechanicStage === "edit" && !mechanicSaved && (
              <p className="text-sm text-muted-foreground">
                Enter the percentages, then review here before anything is saved.
              </p>
            )}
            {mechanicStage === "review" && (
              <>
                <p className="text-sm">
                  <strong>Previous day:</strong> {mechanicDate}
                </p>
                <ul className="space-y-2 text-sm">
                  {mechanicValues.map((entry) => (
                    <li key={entry.technician}>
                      <strong>{entry.technician}:</strong> previous day{" "}
                      {formatProductivity(entry.previous_day)} · weekly{" "}
                      {formatProductivity(entry.weekly)} · monthly{" "}
                      {formatProductivity(entry.monthly)}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button onClick={confirmMechanicSave} disabled={mechanicBusy}>
                    {mechanicBusy ? "Saving…" : "Confirm and save"}
                  </Button>
                  <Button variant="outline" onClick={() => setMechanicStage("edit")}>
                    Back
                  </Button>
                </div>
              </>
            )}
            {mechanicSaved && (
              <p className="rounded-md bg-accent/20 p-3 text-sm font-semibold">{mechanicSaved}</p>
            )}
            {mechanicProblem && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {mechanicProblem}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Not updated"
      />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { saveMetricEntry } from "@/lib/metrics.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate } from "@/components/access-gate";
import { useDashboard } from "./hub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount, formatCurrency, gpPerCar } from "@/lib/metrics-math";

export const Route = createFileRoute("/_authenticated/entry")({
  head: () => ({
    meta: [
      { title: "Daily entry — Cedar Valley Hub" },
      { name: "description", content: "Enter and confirm Cedar Valley daily, month-to-date or year-to-date numbers." },
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
  gross_profit: string;
  tires_sold: string;
  car_count: string;
  note: string;
  correction_note: string;
};

function EntryPage() {
  const dashboard = useDashboard();
  const save = useServerFn(saveMetricEntry);
  const queryClient = useQueryClient();
  const today = dashboard.data?.today ?? "";

  const [draft, setDraft] = useState<Draft>({
    business_date: today,
    scope: "daily",
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

  const date = draft.business_date || today;
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const gp = num(draft.gross_profit);
  const cars = num(draft.car_count);
  const invalid =
    [draft.gross_profit, draft.tires_sold, draft.car_count].some((v) => v.trim() !== "" && !Number.isFinite(Number(v))) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date);

  const existing = dashboard.data?.recent.find((r) => r.business_date === date && r.scope === draft.scope);

  async function confirmSave() {
    setBusy(true);
    setProblem(null);
    setSaved(null);
    try {
      const result = await save({
        data: {
          business_date: date,
          scope: draft.scope,
          gross_profit: gp,
          tires_sold: num(draft.tires_sold),
          car_count: cars,
          note: draft.note || undefined,
          correction_note: draft.correction_note || undefined,
        },
      });
      setSaved(`Saved to the shop records${result.flags.length ? ` — flagged: ${result.flags.join(", ")}` : ""}.`);
      setStage("edit");
      await queryClient.invalidateQueries();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "The entry was not saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Daily entry" subtitle="Manual numbers are saved with the business date, scope and your account.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Enter numbers</CardTitle>
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
            <div className="grid gap-4 sm:grid-cols-3">
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
              <Field label="Car count" value={draft.car_count} onChange={(v) => setDraft({ ...draft, car_count: v })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave a box empty when the number is not known — it stays "Not updated" instead of counting as zero.
            </p>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea id="note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </div>
            {existing && (
              <div className="space-y-2 rounded-md border border-border bg-muted p-3">
                <p className="text-sm font-semibold">
                  A confirmed record already exists for {date} ({draft.scope}).
                </p>
                <p className="text-xs text-muted-foreground">
                  Current: {formatCurrency(existing.gross_profit)} GP · {formatCount(existing.tires_sold)} tires ·{" "}
                  {formatCount(existing.car_count)} cars. Saving replaces it and keeps the old value in the correction
                  history.
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
            {invalid && <p className="text-sm text-destructive">Check the date and that every number is numeric.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Review and confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stage === "edit" && !saved && (
              <p className="text-sm text-muted-foreground">Fill the form, then review here before anything is saved.</p>
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
                    <strong>Gross profit:</strong> {formatCurrency(gp)}
                  </li>
                  <li>
                    <strong>Tires sold:</strong> {formatCount(num(draft.tires_sold))}
                  </li>
                  <li>
                    <strong>Car count:</strong> {formatCount(cars)}
                  </li>
                  <li>
                    <strong>GP per car:</strong> {formatCurrency(gpPerCar(gp, cars))}
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
            {problem && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{problem}</p>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Not updated" />
    </div>
  );
}

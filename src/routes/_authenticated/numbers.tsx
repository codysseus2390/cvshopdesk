import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Printer, PencilLine, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AccessGate } from "@/components/access-gate";
import { usePermissions } from "@/components/use-permissions";
import { getNumbersReport, saveNumbersCorrection } from "@/lib/numbers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatDiff,
  formatMetric,
  formatPct,
  resolvePeriod,
  shiftPeriod,
  type PeriodKind,
  type ReportRow,
} from "@/lib/numbers-math";

export const Route = createFileRoute("/_authenticated/numbers")({
  head: () => ({
    meta: [
      { title: "Numbers — Cedar Valley Hub" },
      {
        name: "description",
        content: "Weekly, monthly and yearly Cedar Valley shop numbers with goals and year-over-year comparison.",
      },
      { property: "og:title", content: "Numbers — Cedar Valley Hub" },
      { property: "og:description", content: "Shop performance reporting with goals and year-over-year change." },
    ],
  }),
  component: () => (
    <AccessGate>
      <NumbersPage />
    </AccessGate>
  ),
});

const KINDS: { key: PeriodKind; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

function NumbersPage() {
  const perms = usePermissions();
  const fetchReport = useServerFn(getNumbersReport);
  const saveCorrection = useServerFn(saveNumbersCorrection);
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<PeriodKind>("monthly");
  const [anchor, setAnchor] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const query = useQuery({
    queryKey: ["numbers", kind, anchor ?? "current"],
    queryFn: () => fetchReport({ data: anchor ? { kind, anchor } : { kind } }),
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });

  const report = query.data;
  const canEdit = perms.can("edit_dashboard_numbers") && kind !== "weekly";

  function move(delta: number) {
    const base = report ? report.range : resolvePeriod(kind, new Date().toISOString().slice(0, 10));
    setAnchor(shiftPeriod(base, delta).from);
    setEditing(false);
    setResult(null);
  }

  function switchKind(next: PeriodKind) {
    setKind(next);
    setAnchor(undefined);
    setEditing(false);
    setResult(null);
  }

  const summary = useMemo(
    () => (report?.rows ?? []).filter((r) => ["gross_profit", "car_count", "tires_sold"].includes(r.key)),
    [report?.rows],
  );

  function openEditor() {
    const next: Record<string, string> = {};
    for (const row of report?.rows ?? []) {
      if (row.key === "gp_percent") continue;
      next[row.key] = row.actual === null ? "" : String(Math.round(row.actual * 100) / 100);
    }
    setDraft(next);
    setNote("");
    setResult(null);
    setEditing(true);
  }

  async function submitCorrection() {
    if (!report || kind === "weekly") return;
    setBusy(true);
    setResult(null);
    const num = (key: string) => {
      const raw = (draft[key] ?? "").trim();
      return raw === "" ? null : Number(raw);
    };
    try {
      await saveCorrection({
        data: {
          kind,
          anchor: report.range.from,
          sales: num("sales"),
          gross_profit: num("gross_profit"),
          tires_sold: num("tires_sold"),
          car_count: num("car_count"),
          productivity: report.technicians.map((technician) => ({
            technician,
            value: num(`productivity:${technician}`),
          })),
          note: note.trim() || undefined,
        },
      });
      setEditing(false);
      setResult({ ok: true, text: "Saved. The corrected numbers are now used everywhere in the app." });
      await queryClient.invalidateQueries();
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!report) return;
    const header = ["Metric", "Actual", "Goal", "Variance", "Variance %", "Previous year", "YoY change"];
    const lines = [header.join(",")];
    for (const row of report.rows) {
      lines.push(
        [
          row.label,
          formatMetric(row.actual, row.format),
          formatMetric(row.goal, row.format),
          formatDiff(row.variance, row.format),
          formatPct(row.variance_pct),
          formatMetric(row.previous, row.format),
          `${formatDiff(row.yoy_diff, row.format)} / ${formatPct(row.yoy_pct)}`,
        ]
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cedar-valley-numbers-${report.range.from}-${report.range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Numbers" subtitle="Actual against goal and the same period last year, from confirmed records.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {KINDS.map((option) => (
            <Button
              key={option.key}
              size="sm"
              variant={kind === option.key ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => switchKind(option.key)}
            >
              {option.label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button size="icon" variant="outline" aria-label="Previous period" onClick={() => move(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[9rem] text-center font-display text-lg font-bold">
              {report?.range.label ?? "…"}
            </span>
            <Button size="icon" variant="outline" aria-label="Next period" onClick={() => move(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAnchor(undefined); setEditing(false); }}>
              Current
            </Button>
          </div>
        </div>

        {query.isLoading && <p className="text-muted-foreground">Loading confirmed records…</p>}
        {query.error && (
          <p className="text-destructive">{query.error instanceof Error ? query.error.message : "Could not load."}</p>
        )}

        {report && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summary.map((row) => (
                <Card key={row.key}>
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
                    <p className="mt-1 font-display text-2xl font-bold">{formatMetric(row.actual, row.format)}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.goal === null ? "No goal set" : `${formatMetric(row.goal, row.format)} goal`}
                      {row.variance !== null && ` · ${formatDiff(row.variance, row.format)}`}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="font-display">
                  {report.range.label} · compared with {report.previousRange.label}
                </CardTitle>
                <div className="flex flex-wrap gap-2 print:hidden">
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer className="mr-1 h-4 w-4" /> Print
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportCsv}>
                    <Download className="mr-1 h-4 w-4" /> CSV
                  </Button>
                  {canEdit && (
                    <Button size="sm" onClick={openEditor}>
                      <PencilLine className="mr-1 h-4 w-4" /> Edit numbers
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[46rem] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4">Metric</th>
                        <th className="py-2 pr-4">Actual</th>
                        <th className="py-2 pr-4">Goal</th>
                        <th className="py-2 pr-4">Variance</th>
                        <th className="py-2 pr-4">{report.previousRange.label}</th>
                        <th className="py-2 pr-4">YoY change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => (
                        <MetricRow
                          key={row.key}
                          row={row}
                          editing={editing && row.key !== "gp_percent"}
                          value={draft[row.key] ?? ""}
                          onChange={(next) => setDraft((prev) => ({ ...prev, [row.key]: next }))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.basis === "cumulative-snapshot"
                    ? `From the accepted ${kind === "yearly" ? "year" : "month"}-to-date record as of ${report.as_of}.`
                    : report.basis === "monthly-rollup"
                      ? `Rolled up from the accepted monthly totals through ${report.as_of}.`
                      : report.basis === "daily-sum"
                      ? `Sum of ${report.covered_days} confirmed day(s) through ${report.as_of}.`
                      : "No confirmed records for this period yet. Nothing is assumed to be zero."}{" "}
                  A dash means the number is not available — never treated as zero.
                </p>
                {result && (
                  <p className={`text-sm ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>{result.text}</p>
                )}
                {kind === "weekly" && perms.can("edit_dashboard_numbers") && (
                  <p className="text-xs text-muted-foreground print:hidden">
                    Weekly figures come from the saved daily records — correct a single day on the Daily entry page.
                  </p>
                )}
              </CardContent>
            </Card>

            {editing && (
              <Card className="print:hidden">
                <CardHeader>
                  <CardTitle className="font-display">Correct {report.range.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Type directly into the Actual column above. Leave a box blank for “Not updated”.
                  </p>
                  <div className="space-y-1">
                    <Label htmlFor="correction-note">Correction note (optional)</Label>
                    <Input
                      id="correction-note"
                      value={note}
                      placeholder="Corrected from TireShop report"
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The previous record is kept and superseded. Gross profit % is worked out from sales and gross profit.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={submitCorrection} disabled={busy}>
                      {busy ? "Saving…" : "Save correction"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="font-display">Change history for this period</CardTitle>
              </CardHeader>
              <CardContent>
                {report.corrections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No corrections recorded for {report.range.label}.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {report.corrections.map((c) => (
                      <li key={c.id} className="rounded-lg border border-border/70 p-3">
                        <p className="font-semibold">
                          {c.field} · {c.business_date}
                        </p>
                        <p className="text-muted-foreground">
                          {c.previous_value ?? "Not updated"} → {c.new_value ?? "Not updated"} ·{" "}
                          {new Date(c.corrected_at).toLocaleString()}
                        </p>
                        {c.note && <p className="text-xs text-muted-foreground">Note: {c.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

function MetricRow({
  row,
  editing = false,
  value = "",
  onChange,
}: {
  row: ReportRow;
  editing?: boolean;
  value?: string;
  onChange?: (next: string) => void;
}) {
  const up = (row.yoy_diff ?? 0) > 0;
  const down = (row.yoy_diff ?? 0) < 0;
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 font-semibold">
        {row.label}
        {row.adjusted && (
          <Badge variant="outline" className="ml-2 align-middle text-[10px]">
            Adjusted
          </Badge>
        )}
      </td>
      <td className="py-2 pr-4">
        {editing ? (
          <Input
            aria-label={`${row.label} value`}
            inputMode="decimal"
            className="h-9 w-32"
            placeholder="Not updated"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
          />
        ) : (
          formatMetric(row.actual, row.format)
        )}
      </td>
      <td className="py-2 pr-4 text-muted-foreground">{formatMetric(row.goal, row.format)}</td>
      <td className="py-2 pr-4">
        {formatDiff(row.variance, row.format)}
        {row.variance_pct !== null && <span className="text-muted-foreground"> / {formatPct(row.variance_pct)}</span>}
      </td>
      <td className="py-2 pr-4 text-muted-foreground">{formatMetric(row.previous, row.format)}</td>
      <td className="py-2 pr-4">
        <span className="inline-flex items-center gap-1">
          {up && <TrendingUp className="h-3.5 w-3.5" aria-hidden />}
          {down && <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
          {formatDiff(row.yoy_diff, row.format)}
          {row.yoy_pct !== null && <span className="text-muted-foreground"> / {formatPct(row.yoy_pct)}</span>}
        </span>
      </td>
    </tr>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listMetricHistory } from "@/lib/metrics.functions";
import { getImportFileUrl } from "@/lib/imports.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCount, formatCurrency, shopToday } from "@/lib/metrics-math";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History — Cedar Valley Hub" },
      {
        name: "description",
        content: "Filter saved Cedar Valley daily records, corrections and supporting uploads.",
      },
      { property: "og:title", content: "History — Cedar Valley Hub" },
      { property: "og:description", content: "Saved shop records, corrections and uploads." },
    ],
  }),
  component: () => (
    <AccessGate>
      <HistoryPage />
    </AccessGate>
  ),
});

function HistoryPage() {
  const today = shopToday();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const fetchHistory = useServerFn(listMetricHistory);
  const signUrl = useServerFn(getImportFileUrl);

  const { data, isLoading, error } = useQuery({
    queryKey: ["history", from, to],
    queryFn: () => fetchHistory({ data: { from, to } }),
  });

  async function openUpload(importId: string) {
    const { url } = await signUrl({ data: { importId } });
    window.open(url, "_blank", "noopener");
  }

  return (
    <AppShell
      title="History"
      subtitle="Every saved snapshot, including replaced ones, with its source."
    >
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Could not load."}
        </p>
      )}

      {data && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Saved snapshots</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No records saved in this range.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Date</th>
                      <th>Scope</th>
                      <th>GP</th>
                      <th>Tires</th>
                      <th>Cars</th>
                      <th>Source</th>
                      <th>State</th>
                      <th>Upload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="py-2 font-semibold">{row.business_date}</td>
                        <td className="uppercase">{row.scope}</td>
                        <td>{formatCurrency(row.gross_profit)}</td>
                        <td>{formatCount(row.tires_sold)}</td>
                        <td>{formatCount(row.car_count)}</td>
                        <td>{row.source}</td>
                        <td>
                          {row.is_current ? (
                            <Badge>Current</Badge>
                          ) : (
                            <Badge variant="secondary">Replaced</Badge>
                          )}
                        </td>
                        <td>
                          {row.import_id ? (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => openUpload(row.import_id as string)}
                            >
                              {(row.imports as { file_name?: string } | null)?.file_name ??
                                "View file"}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">Manual</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display">Correction history</CardTitle>
            </CardHeader>
            <CardContent>
              {data.corrections.length === 0 ? (
                <p className="text-sm text-muted-foreground">No corrections in this range.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.corrections.map((c) => (
                    <li key={c.id} className="border-b border-border pb-2">
                      <strong>
                        {c.business_date} ({c.scope}) {c.field}
                      </strong>
                      : {c.previous_value ?? "Not updated"} → {c.new_value ?? "Not updated"} ·{" "}
                      {new Date(c.corrected_at).toLocaleString()}
                      {c.note ? ` · ${c.note}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

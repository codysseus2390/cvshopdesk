import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptImport,
  extractImport,
  getImportFileUrl,
  listImports,
  registerImport,
  rejectImport,
} from "@/lib/imports.functions";
import { acceptImportRecords } from "@/lib/records.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate, useShopContext } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { shopToday } from "@/lib/metrics-math";

export const Route = createFileRoute("/_authenticated/imports")({
  head: () => ({
    meta: [
      { title: "Imports — Cedar Valley Hub" },
      {
        name: "description",
        content: "Upload Cedar Valley reports and screenshots, review what was read, then confirm the numbers.",
      },
      { property: "og:title", content: "Imports — Cedar Valley Hub" },
      { property: "og:description", content: "Upload reports and review extracted values before saving." },
    ],
  }),
  component: () => (
    <AccessGate>
      <ImportsPage />
    </AccessGate>
  ),
});

type ScopeValue = "daily" | "mtd" | "ytd" | "invoice" | "inventory" | "jobs" | "other";
type RecordKind = "inventory" | "jobs" | "appointments" | "customers";


interface ExtractedRow {
  business_date: string;
  scope: "daily" | "mtd" | "ytd";
  gross_profit: string;
  tires_sold: string;
  car_count: string;
  confidence: string;
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ImportsPage() {
  const shopContext = useShopContext();
  const shopId = shopContext.data?.shop?.id;
  const queryClient = useQueryClient();

  const register = useServerFn(registerImport);
  const extract = useServerFn(extractImport);
  const accept = useServerFn(acceptImport);
  const acceptRecords = useServerFn(acceptImportRecords);
  const reject = useServerFn(rejectImport);
  const signUrl = useServerFn(getImportFileUrl);
  const fetchImports = useServerFn(listImports);

  const imports = useQuery({ queryKey: ["imports"], queryFn: () => fetchImports() });

  const [file, setFile] = useState<File | null>(null);
  const [scope, setScope] = useState<ScopeValue>("daily");
  const [periodStart, setPeriodStart] = useState(shopToday());
  const [periodEnd, setPeriodEnd] = useState(shopToday());
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);

  const [reviewId, setReviewId] = useState<string | null>(null);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [items, setItems] = useState<Record<string, string | number | null>[]>([]);
  const [recordKind, setRecordKind] = useState<RecordKind>("inventory");
  const [unreadable, setUnreadable] = useState<string[]>([]);

  const itemColumns = Array.from(new Set(items.flatMap((item) => Object.keys(item)))).slice(0, 12);


  async function upload() {
    if (!file || !shopId) return;
    setBusy("upload");
    setStatus(null);
    try {
      const hash = await sha256(file);
      const folder = crypto.randomUUID();
      const path = `${shopId}/${folder}/${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("shop-uploads")
        .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (upErr) throw new Error(`The file could not be stored: ${upErr.message}`);

      const result = await register({
        data: {
          file_name: file.name,
          storage_path: path,
          mime_type: file.type || "application/octet-stream",
          file_hash: hash,
          file_size: file.size,
          report_scope: scope,
          period_start: periodStart || null,
          period_end: periodEnd || null,
        },
      });

      if (result.duplicate) {
        await supabase.storage.from("shop-uploads").remove([path]);
        setStatus({
          kind: "warn",
          text: `This exact file was already uploaded${result.existing?.uploaded_at ? ` on ${new Date(result.existing.uploaded_at).toLocaleString()}` : ""}. Nothing was added again.`,
        });
      } else {
        setStatus({ kind: "ok", text: "File saved. Now read it and review the values before they count." });
        setFile(null);
      }
      await queryClient.invalidateQueries({ queryKey: ["imports"] });
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setBusy(null);
    }
  }

  async function runExtract(importId: string) {
    setBusy(importId);
    setStatus(null);
    try {
      const result = await extract({ data: { importId } });
      await queryClient.invalidateQueries({ queryKey: ["imports"] });
      if (!result.ok) {
        setStatus({ kind: "error", text: result.message });
        return;
      }
      openReview(importId, result.extraction as Record<string, unknown>);
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Reading the file failed." });
    } finally {
      setBusy(null);
    }
  }

  function openReview(importId: string, extraction: Record<string, unknown> | null) {
    setReviewId(importId);
    const raw = (extraction?.["rows"] as Record<string, unknown>[] | undefined) ?? [];
    setRows(
      raw.map((r) => ({
        business_date: String(r["business_date"] ?? ""),
        scope: (["daily", "mtd", "ytd"].includes(String(r["scope"])) ? String(r["scope"]) : "daily") as
          | "daily"
          | "mtd"
          | "ytd",
        gross_profit: r["gross_profit"] === null || r["gross_profit"] === undefined ? "" : String(r["gross_profit"]),
        tires_sold: r["tires_sold"] === null || r["tires_sold"] === undefined ? "" : String(r["tires_sold"]),
        car_count: r["car_count"] === null || r["car_count"] === undefined ? "" : String(r["car_count"]),
        confidence: String(r["confidence"] ?? "unknown"),
      })),
    );
    setItems((extraction?.["items"] as Record<string, string | number | null>[] | undefined) ?? []);
    const suggested = String(extraction?.["record_kind"] ?? "");
    if (["inventory", "jobs", "appointments", "customers"].includes(suggested)) {
      setRecordKind(suggested as RecordKind);
    }
    setUnreadable((extraction?.["unreadable"] as string[] | undefined) ?? []);

  }

  async function confirmMetrics() {
    if (!reviewId) return;
    setBusy(reviewId);
    setStatus(null);
    try {
      const payload = rows
        .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.business_date))
        .map((r) => ({
          business_date: r.business_date,
          scope: r.scope,
          gross_profit: r.gross_profit.trim() === "" ? null : Number(r.gross_profit),
          tires_sold: r.tires_sold.trim() === "" ? null : Math.round(Number(r.tires_sold)),
          car_count: r.car_count.trim() === "" ? null : Math.round(Number(r.car_count)),
          flags: r.confidence === "high" ? [] : [`confidence:${r.confidence}`],
        }));
      if (!payload.length) throw new Error("Add a valid business date to at least one row before saving.");
      const result = await accept({ data: { importId: reviewId, rows: payload } });
      setStatus({ kind: "ok", text: `${result.savedRows} row(s) saved to the shop records.` });
      setReviewId(null);
      await queryClient.invalidateQueries();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Nothing was saved." });
    } finally {
      setBusy(null);
    }
  }

  async function confirmRecords(kind: RecordKind) {
    if (!reviewId || !items.length) return;
    setBusy(reviewId);
    setStatus(null);
    try {
      const result = await acceptRecords({
        data: { importId: reviewId, kind, snapshot_date: periodEnd || shopToday(), items },
      });
      setStatus({
        kind: "ok",
        text: `${result.saved} record(s) saved as an imported snapshot${
          result.needsReview > 0 ? ` · ${result.needsReview} row(s) marked for a check` : ""
        }.`,
      });
      setReviewId(null);
      await queryClient.invalidateQueries();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Nothing was saved." });
    } finally {
      setBusy(null);
    }
  }


  return (
    <AppShell
      title="Imports"
      subtitle="Uploaded files are kept exactly as sent. Nothing counts until you confirm it here."
    >
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Upload a report or screenshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*,application/pdf,.csv,.xlsx,.xls"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scope">What is in this file?</Label>
                <select
                  id="scope"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as ScopeValue)}
                >
                  <option value="daily">Daily totals</option>
                  <option value="mtd">Month-to-date totals</option>
                  <option value="ytd">Year-to-date totals</option>
                  <option value="invoice">Invoice list</option>
                  <option value="inventory">Inventory list</option>
                  <option value="jobs">Jobs / appointments</option>
                  <option value="other">Something else</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 md:col-span-1">
                <div className="space-y-2">
                  <Label htmlFor="ps">Covers from</Label>
                  <Input id="ps" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pe">to</Label>
                  <Input id="pe" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <Button onClick={upload} disabled={!file || !shopId || busy === "upload"}>
              {busy === "upload" ? "Uploading…" : "Upload file"}
            </Button>
            {status && (
              <p
                className={
                  status.kind === "ok"
                    ? "rounded-md bg-accent/20 p-3 text-sm font-semibold"
                    : status.kind === "warn"
                      ? "rounded-md bg-muted p-3 text-sm"
                      : "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                }
              >
                {status.text}
              </p>
            )}
          </CardContent>
        </Card>

        {reviewId && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Review before it counts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {unreadable.length > 0 && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-semibold">Flagged as unclear — check these against the file:</p>
                  <ul className="list-disc pl-5">
                    {unreadable.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </div>
              )}
              {rows.length > 0 ? (
                <div className="space-y-3">
                  {rows.map((row, i) => (
                    <div key={i} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-6">
                      <Input
                        type="date"
                        value={row.business_date}
                        onChange={(e) =>
                          setRows(rows.map((r, j) => (i === j ? { ...r, business_date: e.target.value } : r)))
                        }
                      />
                      <select
                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={row.scope}
                        onChange={(e) =>
                          setRows(
                            rows.map((r, j) =>
                              i === j ? { ...r, scope: e.target.value as ExtractedRow["scope"] } : r,
                            ),
                          )
                        }
                      >
                        <option value="daily">daily</option>
                        <option value="mtd">mtd</option>
                        <option value="ytd">ytd</option>
                      </select>
                      <Input
                        placeholder="Gross profit"
                        value={row.gross_profit}
                        onChange={(e) =>
                          setRows(rows.map((r, j) => (i === j ? { ...r, gross_profit: e.target.value } : r)))
                        }
                      />
                      <Input
                        placeholder="Tires"
                        value={row.tires_sold}
                        onChange={(e) =>
                          setRows(rows.map((r, j) => (i === j ? { ...r, tires_sold: e.target.value } : r)))
                        }
                      />
                      <Input
                        placeholder="Cars"
                        value={row.car_count}
                        onChange={(e) =>
                          setRows(rows.map((r, j) => (i === j ? { ...r, car_count: e.target.value } : r)))
                        }
                      />
                      <Badge variant={row.confidence === "high" ? "default" : "secondary"}>{row.confidence}</Badge>
                    </div>
                  ))}
                  <Button onClick={confirmMetrics} disabled={busy === reviewId}>
                    {busy === reviewId ? "Saving…" : "Confirm these numbers"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No metric rows were read from this file.</p>
              )}

              {items.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">
                    {items.length} detail row(s) read from this file — edit anything that is wrong before saving
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="rk">These rows are</Label>
                      <select
                        id="rk"
                        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                        value={recordKind}
                        onChange={(e) => setRecordKind(e.target.value as RecordKind)}
                      >
                        <option value="inventory">Inventory items</option>
                        <option value="jobs">Existing job records</option>
                        <option value="appointments">Existing appointment records</option>
                        <option value="customers">Customers &amp; vehicles</option>
                      </select>
                    </div>
                    <Button onClick={() => confirmRecords(recordKind)} disabled={busy === reviewId}>
                      {busy === reviewId ? "Saving…" : "Save these existing records"}
                    </Button>
                  </div>
                  <div className="max-h-96 overflow-auto rounded-md border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          {itemColumns.map((col) => (
                            <th key={col} className="p-2 text-left font-semibold">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className="border-t border-border">
                            {itemColumns.map((col) => (
                              <td key={col} className="p-1">
                                <Input
                                  className="h-8 min-w-24 text-xs"
                                  value={item[col] === null || item[col] === undefined ? "" : String(item[col])}
                                  onChange={(e) =>
                                    setItems(
                                      items.map((row, j) =>
                                        i === j ? { ...row, [col]: e.target.value === "" ? null : e.target.value } : row,
                                      ),
                                    )
                                  }
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Blanks and values like N/A stay empty — they are never saved as zero. Rows without a TireShop record
                    number are kept against this upload and marked for a check. These save existing TireShop records into
                    this app only. Nothing is booked or created in TireShop.
                  </p>
                </div>
              )}

              <Button variant="ghost" onClick={() => setReviewId(null)}>
                Close review
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Uploaded files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {imports.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {imports.data?.length === 0 && <p className="text-sm text-muted-foreground">No files uploaded yet.</p>}
            {imports.data?.map((imp) => (
              <div key={imp.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <p className="font-semibold">{imp.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {imp.report_scope} · covers {imp.period_start ?? "?"} → {imp.period_end ?? "?"} · uploaded{" "}
                    {new Date(imp.uploaded_at).toLocaleString()} · {imp.status}
                    {imp.error_message ? ` · ${imp.error_message}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void openFile(imp.id)}>
                    View file
                  </Button>
                  <Button size="sm" onClick={() => runExtract(imp.id)} disabled={busy === imp.id}>
                    {busy === imp.id ? "Reading…" : "Read with AI"}
                  </Button>
                  {imp.extraction && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReview(imp.id, imp.extraction as Record<string, unknown>)}
                    >
                      Review
                    </Button>
                  )}
                  {imp.status !== "accepted" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await reject({ data: { importId: imp.id, reason: "Rejected by staff" } });
                        await queryClient.invalidateQueries({ queryKey: ["imports"] });
                      }}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );

  async function openFile(importId: string) {
    try {
      const { url } = await signUrl({ data: { importId } });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "The file could not be opened." });
    }
  }
}

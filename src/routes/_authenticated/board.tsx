import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listBoard, updateJobLocalState } from "@/lib/records.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({
    meta: [
      { title: "Jobs & appointments — Cedar Valley Hub" },
      {
        name: "description",
        content: "Read-only Cedar Valley job and appointment records from imports, with local staff notes.",
      },
      { property: "og:title", content: "Jobs & appointments — Cedar Valley Hub" },
      { property: "og:description", content: "Imported job and appointment records with local notes." },
    ],
  }),
  component: () => (
    <AccessGate>
      <BoardPage />
    </AccessGate>
  ),
});

export function useBoard() {
  const fetchBoard = useServerFn(listBoard);
  return useQuery({ queryKey: ["board"], queryFn: () => fetchBoard(), refetchInterval: 60_000 });
}

export function waitingSince(arrivalAt: string | null) {
  if (!arrivalAt) return "Arrival time not recorded";
  const minutes = Math.round((Date.now() - new Date(arrivalAt).getTime()) / 60000);
  if (minutes < 0) return "Arrival time not recorded";
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `Waiting ${hours}h ${minutes % 60}m` : `Waiting ${minutes}m`;
}

function BoardPage() {
  const { data, isLoading, error } = useBoard();
  const update = useServerFn(updateJobLocalState);
  const queryClient = useQueryClient();
  const [edit, setEdit] = useState<{ id: string; status: string; note: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function saveLocal() {
    if (!edit) return;
    setProblem(null);
    try {
      await update({
        data: {
          jobId: edit.id,
          local_status: edit.status.trim() === "" ? null : edit.status,
          local_note: edit.note.trim() === "" ? null : edit.note,
        },
      });
      setEdit(null);
      await queryClient.invalidateQueries({ queryKey: ["board"] });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "The note was not saved.");
    }
  }

  return (
    <AppShell
      title="Jobs & appointments"
      subtitle={
        <>
          Imported records only — this app never books or creates anything in TireShop. Last snapshot:{" "}
          {data?.lastSnapshot ? new Date(data.lastSnapshot).toLocaleString() : "none yet"}
        </>
      }
    >
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error instanceof Error ? error.message : "Could not load."}</p>}
      {problem && <p className="text-destructive">{problem}</p>}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Upcoming appointments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.appointments.length === 0 && (
                <p className="text-sm text-muted-foreground">No appointment records imported yet.</p>
              )}
              {data.appointments.map((job) => (
                <div key={job.id} className="border-b border-border pb-3">
                  <p className="font-semibold">
                    {job.appointment_at ? new Date(job.appointment_at).toLocaleString() : "Time not recorded"} ·{" "}
                    {job.customer_name ?? "Customer not recorded"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {job.vehicle_label ?? "Vehicle not recorded"} · {job.requested_service ?? "Service not recorded"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display">Unfinished job queue (oldest first)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.jobs.length === 0 && <p className="text-sm text-muted-foreground">No job records imported yet.</p>}
              {data.jobs.map((job) => (
                <div key={job.id} className="space-y-1 border-b border-border pb-3">
                  <p className="font-semibold">{job.customer_name ?? "Customer not recorded"}</p>
                  <p className="text-sm text-muted-foreground">
                    {job.vehicle_label ?? "Vehicle not recorded"} · {job.requested_service ?? "Service not recorded"} ·{" "}
                    {job.technician ?? "Tech not assigned"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {job.disposition && <Badge variant="secondary">{job.disposition}</Badge>}
                    {job.job_status && <Badge variant="secondary">{job.job_status}</Badge>}
                    {job.local_status && <Badge>{job.local_status} (in-app)</Badge>}
                    <span className="text-xs text-muted-foreground">{waitingSince(job.arrival_at)}</span>
                  </div>
                  {job.local_note && <p className="text-sm">In-app note: {job.local_note}</p>}
                  {edit?.id === job.id ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Input
                        className="max-w-40"
                        placeholder="In-app status"
                        value={edit.status}
                        onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                      />
                      <Input
                        className="max-w-64"
                        placeholder="In-app note"
                        value={edit.note}
                        onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                      />
                      <Button size="sm" onClick={saveLocal}>
                        Save in this app
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEdit({ id: job.id, status: job.local_status ?? "", note: job.local_note ?? "" })
                      }
                    >
                      Add in-app status / note
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

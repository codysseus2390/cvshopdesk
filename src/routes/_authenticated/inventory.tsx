import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listInventory } from "@/lib/records.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate } from "@/components/access-gate";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatCount, formatCurrency } from "@/lib/metrics-math";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Cedar Valley Hub" },
      { name: "description", content: "Look up Cedar Valley tire and parts inventory from confirmed import snapshots." },
      { property: "og:title", content: "Inventory — Cedar Valley Hub" },
      { property: "og:description", content: "Inventory lookup from confirmed import snapshots." },
    ],
  }),
  component: () => (
    <AccessGate>
      <InventoryPage />
    </AccessGate>
  ),
});

function InventoryPage() {
  const [search, setSearch] = useState("");
  const fetchInventory = useServerFn(listInventory);
  const { data, isLoading } = useQuery({
    queryKey: ["inventory", search],
    queryFn: () => fetchInventory({ data: { search } }),
  });

  return (
    <AppShell title="Inventory" subtitle="Snapshots from confirmed imports. Each row shows the day it was captured.">
      <Input
        className="mb-6 max-w-sm"
        placeholder="Search brand, size or description"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Card>
        <CardContent className="overflow-x-auto p-6">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No inventory saved yet. Upload an inventory report on the Imports page and confirm it.
            </p>
          )}
          {!!data?.length && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Item</th>
                  <th>Brand</th>
                  <th>Size</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Cost</th>
                  <th>Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="py-2 font-semibold">{item.description}</td>
                    <td>{item.brand ?? "—"}</td>
                    <td>{item.size ?? "—"}</td>
                    <td>{formatCount(item.quantity)}</td>
                    <td>{formatCurrency(item.price)}</td>
                    <td>{formatCurrency(item.cost)}</td>
                    <td>{item.snapshot_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

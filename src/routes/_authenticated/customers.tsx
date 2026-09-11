import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listCustomers } from "@/lib/records.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate } from "@/components/access-gate";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Cedar Valley Hub" },
      { name: "description", content: "Search Cedar Valley customers and their vehicles from confirmed imports." },
      { property: "og:title", content: "Customers — Cedar Valley Hub" },
      { property: "og:description", content: "Customer and vehicle history from confirmed imports." },
    ],
  }),
  component: () => (
    <AccessGate>
      <CustomersPage />
    </AccessGate>
  ),
});

interface Vehicle {
  id: string;
  year: string | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  plate: string | null;
}

function CustomersPage() {
  const [search, setSearch] = useState("");
  const fetchCustomers = useServerFn(listCustomers);
  const { data, isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => fetchCustomers({ data: { search } }),
  });

  return (
    <AppShell title="Customers" subtitle="Only customers that arrived through confirmed imports appear here.">
      <Input
        className="mb-6 max-w-sm"
        placeholder="Search name, phone or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No customers saved yet. Confirm a customer or invoice import to populate this list.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((customer) => (
          <Card key={customer.id}>
            <CardContent className="space-y-2 p-6">
              <p className="font-display text-lg font-bold">{customer.name}</p>
              <p className="text-sm text-muted-foreground">
                {customer.phone ?? "No phone"} · {customer.email ?? "No email"}
              </p>
              <ul className="space-y-1 text-sm">
                {((customer.vehicles as Vehicle[] | null) ?? []).map((v) => (
                  <li key={v.id}>
                    {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}
                    {v.plate ? ` · ${v.plate}` : ""}
                  </li>
                ))}
                {(((customer.vehicles as Vehicle[] | null) ?? []).length === 0) && (
                  <li className="text-muted-foreground">No vehicle recorded</li>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { claimShop, getShopContext, requestAccess } from "@/lib/shop.functions";
import { CedarLogo } from "@/components/cedar-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

export function useShopContext() {
  const fetchContext = useServerFn(getShopContext);
  return useQuery({ queryKey: ["shop-context"], queryFn: () => fetchContext() });
}

/** Renders children only for approved members; otherwise shows setup or pending state. */
export function AccessGate({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useShopContext();
  const claim = useServerFn(claimShop);
  const request = useServerFn(requestAccess);
  const queryClient = useQueryClient();
  const [name, setName] = useState("Cedar Valley Tire & Auto Service");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  if (isLoading) {
    return <Centered>Checking your staff access…</Centered>;
  }
  if (error) {
    return <Centered>{error instanceof Error ? error.message : "Access could not be checked."}</Centered>;
  }
  if (data?.membership?.status === "approved") {
    return <>{children}</>;
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ["shop-context"] });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Centered>
      <Card className="w-full max-w-md text-left">
        <CardHeader>
          <CedarLogo className="mb-4 h-12 w-auto" />
          <CardTitle className="font-display text-2xl">
            {!data?.shopExists && data?.isOwnerEmail
              ? "Set up the shop"
              : data?.membership?.status === "pending" || requested
                ? "Waiting for approval"
                : data?.membership?.status === "revoked"
                  ? "Access removed"
                  : "Request staff access"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!data?.shopExists && data?.isOwnerEmail && (
            <>
              <p className="text-sm text-muted-foreground">
                You are signed in as the owner account. Name the shop to finish setup.
              </p>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Button disabled={busy} onClick={() => run(() => claim({ data: { name } }))}>
                {busy ? "Saving…" : "Create shop"}
              </Button>
            </>
          )}
          {!data?.shopExists && !data?.isOwnerEmail && (
            <p className="text-sm text-muted-foreground">
              The shop has not been set up yet. Only the owner account can do that first step.
            </p>
          )}
          {data?.shopExists && !data.membership && (
            <>
              <p className="text-sm text-muted-foreground">
                Ask the owner to approve your account. Nothing is visible until they do.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await request();
                    setRequested(true);
                  })
                }
              >
                {busy ? "Sending…" : "Request access"}
              </Button>
            </>
          )}
          {(data?.membership?.status === "pending" || requested) && (
            <p className="text-sm text-muted-foreground">
              Your request is saved. The owner approves staff from Settings.
            </p>
          )}
          {data?.membership?.status === "revoked" && (
            <p className="text-sm text-muted-foreground">Your access was removed. Contact the owner.</p>
          )}
          {problem && <p className="text-sm text-destructive">{problem}</p>}
          {data?.email && <p className="text-xs text-muted-foreground">Signed in as {data.email}</p>}
        </CardContent>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-center">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-muted-foreground">{children}</div>
    </div>
  );
}

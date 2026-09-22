import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { advanceSessionEpoch } from "@/lib/session-epoch";

/** Supabase sends cross-tab sign-out events here as well as local auth changes. */
export function SessionBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [identity, setIdentity] = useState<{ userId: string | null; generation: number } | null>(
    null,
  );
  useEffect(() => {
    let userId: string | null | undefined;
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user.id ?? null;
      if (nextUser === userId) return; // Ordinary token refresh keeps the same cache.
      userId = nextUser;
      const generation = advanceSessionEpoch();
      void queryClient.cancelQueries();
      queryClient.clear();
      setIdentity({ userId: nextUser, generation });
      // Never await an auth operation inside Supabase's auth callback.
      queueMicrotask(() => {
        if (active) void router.invalidate();
      });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient, router]);
  if (!identity)
    return (
      <div className="p-6 text-sm text-muted-foreground" role="status">
        Checking sign-in…
      </div>
    );
  return (
    <div key={`${identity.userId ?? "signed-out"}:${identity.generation}`} className="contents">
      {children}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminConfig, saveTvRotationSeconds } from "@/lib/admin.functions";
import {
  TV_ROTATION_SECONDS_DEFAULT,
  TV_ROTATION_SECONDS_MAX,
  TV_ROTATION_SECONDS_MIN,
} from "@/lib/tv-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** TV Mode's screen rotation timer. Owner and admins only — everyone else sees the current value. */
export function TvModeSettings({ canEdit }: { canEdit: boolean }) {
  const fetchConfig = useServerFn(getAdminConfig);
  const save = useServerFn(saveTvRotationSeconds);
  const queryClient = useQueryClient();

  const config = useQuery({ queryKey: ["admin-config"], queryFn: () => fetchConfig() });
  const saved = config.data?.settings.tv_rotation_seconds ?? null;

  const [seconds, setSeconds] = useState(String(saved ?? TV_ROTATION_SECONDS_DEFAULT));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  // Keep the field in sync once the saved value loads, but don't clobber an edit in progress.
  useEffect(() => {
    if (config.data && !busy) setSeconds(String(saved ?? TV_ROTATION_SECONDS_DEFAULT));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.data]);

  async function submit() {
    const value = Math.round(Number(seconds));
    if (!Number.isFinite(value)) {
      setNote({ ok: false, text: "Enter a number of seconds." });
      return;
    }
    if (value < TV_ROTATION_SECONDS_MIN || value > TV_ROTATION_SECONDS_MAX) {
      setNote({
        ok: false,
        text: `Choose between ${TV_ROTATION_SECONDS_MIN} and ${TV_ROTATION_SECONDS_MAX} seconds.`,
      });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await save({ data: { tv_rotation_seconds: value } });
      setNote({ ok: true, text: "Saved. TV Mode will pick this up within a few seconds." });
      await queryClient.invalidateQueries({ queryKey: ["admin-config"] });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 to-secondary/40" />
      <CardHeader>
        <p className="eyebrow">Display</p>
        <CardTitle className="font-display text-xl">TV Mode</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="tv-rotation">TV screen rotation</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tv-rotation"
                type="number"
                min={TV_ROTATION_SECONDS_MIN}
                max={TV_ROTATION_SECONDS_MAX}
                className="w-28"
                value={seconds}
                disabled={!canEdit || config.isLoading}
                onChange={(e) => setSeconds(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">seconds per screen</span>
            </div>
          </div>
          {canEdit && (
            <Button onClick={submit} disabled={busy || config.isLoading}>
              {busy ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          How long each TV Mode screen (shop numbers, then today's shop) stays up before
          automatically switching to the next one. Staff can still jump screens manually from TV
          Mode itself. Default is {TV_ROTATION_SECONDS_DEFAULT} seconds.
        </p>
        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Only the owner and admins can change this.
          </p>
        )}
        {note && (
          <p
            className={
              note.ok
                ? "rounded-md bg-accent/20 p-3 text-sm font-semibold"
                : "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            }
          >
            {note.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

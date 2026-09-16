import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/components/use-permissions";
import { saveNumbersGoals } from "@/lib/numbers.functions";
import { NUMBER_METRICS, productivityMetric, type GoalRule, type GoalRules } from "@/lib/numbers-math";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Draft = Record<string, { method: "fixed" | "growth"; monthly: string; yearly: string; growth_pct: string }>;

const blank = { method: "fixed" as const, monthly: "", yearly: "", growth_pct: "" };

/** Settings → Numbers & Goals. Owner and admins only; staff see the goals on the Numbers page. */
export function NumbersGoals({ canEdit }: { canEdit: boolean }) {
  const perms = usePermissions();
  const save = useServerFn(saveNumbersGoals);
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const technicians = (perms.settings?.technician_goals ?? []).map((g) => g.technician).filter(Boolean);
  const metrics = [...NUMBER_METRICS, ...technicians.map((t) => productivityMetric(t))];

  useEffect(() => {
    const rules = (perms.settings?.goal_rules ?? {}) as GoalRules;
    const next: Draft = {};
    for (const [key, rule] of Object.entries(rules)) {
      next[key] = {
        method: rule.method === "growth" ? "growth" : "fixed",
        monthly: rule.monthly === null || rule.monthly === undefined ? "" : String(rule.monthly),
        yearly: rule.yearly === null || rule.yearly === undefined ? "" : String(rule.yearly),
        growth_pct: rule.growth_pct === null || rule.growth_pct === undefined ? "" : String(rule.growth_pct),
      };
    }
    setDraft(next);
  }, [perms.settings?.goal_rules]);

  const row = (key: string) => draft[key] ?? blank;
  const number = (value: string) => (value.trim() === "" ? null : Number(value));

  async function submit() {
    setBusy(true);
    setNote(null);
    try {
      const rules: Record<string, GoalRule> = {};
      for (const metric of metrics) {
        const entry = draft[metric.key];
        if (!entry) continue;
        const rule: GoalRule =
          entry.method === "growth"
            ? { method: "growth", growth_pct: number(entry.growth_pct) }
            : { method: "fixed", monthly: number(entry.monthly), yearly: number(entry.yearly) };
        const empty =
          entry.method === "growth" ? rule.growth_pct === null : rule.monthly === null && rule.yearly === null;
        if (!empty) rules[metric.key] = rule;
      }
      await save({ data: { goal_rules: rules } });
      await queryClient.invalidateQueries({ queryKey: ["admin-config"] });
      await queryClient.invalidateQueries({ queryKey: ["numbers"] });
      setNote({ ok: true, text: "Goals saved." });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Numbers &amp; Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Only the owner and admins can change goals.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Numbers &amp; Goals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Set a fixed target, or a growth goal measured against the same period last year. Weekly goals are worked out
          from the monthly figure, so there is nothing to type in each week.
        </p>
        {metrics.map((metric) => {
          const entry = row(metric.key);
          return (
            <div key={metric.key} className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-[14rem_1fr]">
              <div>
                <p className="text-sm font-semibold">{metric.label}</p>
                <select
                  aria-label={`${metric.label} goal method`}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={entry.method}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [metric.key]: { ...row(metric.key), method: e.target.value as "fixed" | "growth" },
                    }))
                  }
                >
                  <option value="fixed">Fixed goal</option>
                  <option value="growth">Previous year + %</option>
                </select>
              </div>
              {entry.method === "growth" ? (
                <div className="space-y-1">
                  <Label htmlFor={`growth-${metric.key}`}>Growth over last year (%)</Label>
                  <Input
                    id={`growth-${metric.key}`}
                    inputMode="decimal"
                    value={entry.growth_pct}
                    placeholder="e.g. 8"
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [metric.key]: { ...row(metric.key), growth_pct: e.target.value },
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`monthly-${metric.key}`}>Monthly goal</Label>
                    <Input
                      id={`monthly-${metric.key}`}
                      inputMode="decimal"
                      value={entry.monthly}
                      placeholder="Leave blank"
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [metric.key]: { ...row(metric.key), monthly: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`yearly-${metric.key}`}>Yearly goal</Label>
                    <Input
                      id={`yearly-${metric.key}`}
                      inputMode="decimal"
                      value={entry.yearly}
                      placeholder="Leave blank"
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [metric.key]: { ...row(metric.key), yearly: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save goals"}
          </Button>
          {note && <p className={`text-sm ${note.ok ? "text-muted-foreground" : "text-destructive"}`}>{note.text}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

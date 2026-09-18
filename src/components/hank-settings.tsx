/**
 * Hank Settings — identity, personality, behaviour, model, actions, vision.
 * Personality is stored server-side as developer instructions and is included
 * on every conversation automatically. No API keys are shown or entered here.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAiSettings, saveAiSettings } from "@/lib/ai-settings.functions";
import {
  SHOP_AI_MAX_PERSONALITY_CHARS,
  SHOP_AI_MODEL_TIERS,
  SHOP_AI_MODELS,
} from "@/lib/ai/model-config";
import { ASSISTANT_SETTINGS_DEFAULTS, type AssistantSettings } from "@/lib/ai/persona";
import { HankVoiceSettings } from "@/components/hank-voice-settings";
import { HANK_VOICE_DEFAULTS } from "@/lib/ai/voice-config";

const BEHAVIOR: { key: keyof AssistantSettings; label: string; hint: string }[] = [
  {
    key: "casualLanguage",
    label: "Casual language",
    hint: "Talks like someone in the shop, not a manual.",
  },
  { key: "humor", label: "Humor", hint: "Light jokes when they fit." },
  {
    key: "mildProfanity",
    label: "Mild profanity",
    hint: "Everyday shop language. Never aimed at a person.",
  },
  { key: "shopBanter", label: "Playful shop banter", hint: "A little back and forth with staff." },
  {
    key: "customerFacingProfessional",
    label: "Customer-facing stays professional",
    hint: "Anything a customer sees stays clean and professional no matter the settings above.",
  },
];

export function HankSettings({ canEdit }: { canEdit: boolean }) {
  const load = useServerFn(getAiSettings);
  const save = useServerFn(saveAiSettings);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["ai-settings"], queryFn: () => load() });
  const [form, setForm] = useState<AssistantSettings>(ASSISTANT_SETTINGS_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const set = <K extends keyof AssistantSettings>(key: K, value: AssistantSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const personalityOver = form.personality.length > SHOP_AI_MAX_PERSONALITY_CHARS;

  async function submit() {
    setSaving(true);
    setStatus(null);
    try {
      await save({
        data: {
          assistantName: form.assistantName.trim(),
          subtitle: form.subtitle.trim(),
          avatarUrl: form.avatarUrl?.trim() ? form.avatarUrl.trim() : null,
          personality: form.personality,
          casualLanguage: form.casualLanguage,
          humor: form.humor,
          mildProfanity: form.mildProfanity,
          shopBanter: form.shopBanter,
          customerFacingProfessional: form.customerFacingProfessional,
          modelTier: form.modelTier as "fast" | "standard" | "deep",
          disabledTools: form.disabledTools,
          visionEnabled: form.visionEnabled,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      setStatus({ ok: true, message: "Saved. Hank uses these instructions on his next answer." });
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof Error ? err.message : "That could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading Hank's settings…</p>;

  const tools = data?.tools ?? [];
  const readTools = tools.filter((tool) => !tool.mutating);
  const writeTools = tools.filter((tool) => tool.mutating);

  return (
    <div className="space-y-6">
      {!canEdit && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Only the owner and admins can change these. You can see
          how Hank is set up.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" /> Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hank-name">Assistant name</Label>
            <Input
              id="hank-name"
              value={form.assistantName}
              disabled={!canEdit}
              onChange={(e) => set("assistantName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hank-subtitle">Display subtitle</Label>
            <Input
              id="hank-subtitle"
              value={form.subtitle}
              disabled={!canEdit}
              onChange={(e) => set("subtitle", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="hank-avatar">Avatar image link (optional)</Label>
            <Input
              id="hank-avatar"
              placeholder="Leave empty to use the default icon"
              value={form.avatarUrl ?? ""}
              disabled={!canEdit}
              onChange={(e) => set("avatarUrl", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personality</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Standing instructions for Hank. Saved with the shop and sent behind the scenes on every
            conversation — nobody has to paste them into chat, and they are never shown in the chat
            itself.
          </p>
          <Textarea
            value={form.personality}
            disabled={!canEdit}
            rows={14}
            onChange={(e) => set("personality", e.target.value)}
            placeholder="How Hank should talk, what he should always check, what he should never do…"
            className="min-h-[240px]"
          />
          <p
            className={`text-right text-[11px] ${personalityOver ? "text-destructive" : "text-muted-foreground"}`}
          >
            {form.personality.length.toLocaleString()} /{" "}
            {SHOP_AI_MAX_PERSONALITY_CHARS.toLocaleString()} characters
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {BEHAVIOR.map((item) => (
            <div key={String(item.key)} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </div>
              <Switch
                checked={Boolean(form[item.key])}
                disabled={!canEdit}
                onCheckedChange={(value) => set(item.key, value as never)}
                aria-label={item.label}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Current model:{" "}
            <span className="font-medium text-foreground">{SHOP_AI_MODELS.fast}</span>. Tiers are
            set up here so Fast, Standard and Deep can be pointed at different models later without
            touching the chat.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {SHOP_AI_MODEL_TIERS.map((tier) => (
              <button
                key={tier.key}
                type="button"
                disabled={!canEdit}
                onClick={() => set("modelTier", tier.key)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  form.modelTier === tier.key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/60"
                }`}
              >
                <p className="text-sm font-semibold">{tier.label}</p>
                <p className="text-xs text-muted-foreground">{tier.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Read only</p>
            <div className="flex flex-wrap gap-1.5">
              {readTools.map((tool) => (
                <Badge key={tool.name} variant="secondary">
                  {tool.label}
                </Badge>
              ))}
              {readTools.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Can change app data</p>
            {writeTools.map((tool) => {
              const off = form.disabledTools.includes(tool.name);
              return (
                <div key={tool.name} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tool.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {tool.description}
                      {tool.requiresConfirmation ? " Asks you first." : ""}
                    </p>
                  </div>
                  <Switch
                    checked={!off}
                    disabled={!canEdit}
                    aria-label={`Allow ${tool.label}`}
                    onCheckedChange={(value) =>
                      set(
                        "disabledTools",
                        value
                          ? form.disabledTools.filter((name) => name !== tool.name)
                          : [...form.disabledTools, tool.name],
                      )
                    }
                  />
                </div>
              );
            })}
            {writeTools.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Turning something on here never skips sign-in, permissions, validation or the
            confirmation step. Everyone still only does what their own account allows.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Images &amp; files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Image and file analysis</p>
              <p className="text-xs text-muted-foreground">
                Screenshots, photos and PDFs staff paste or attach in chat.
              </p>
            </div>
            <Switch
              checked={form.visionEnabled}
              disabled={!canEdit}
              aria-label="Image and file analysis"
              onCheckedChange={(value) => set("visionEnabled", value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Accepted: {(data?.attachments.types ?? []).join(", ")} — up to{" "}
            {Math.round((data?.attachments.maxFileBytes ?? 0) / (1024 * 1024))} MB each,{" "}
            {data?.attachments.maxFiles ?? 0} per message.
          </p>
          <p className="text-xs text-muted-foreground">
            OpenAI connection: {data?.apiKeyConfigured ? "configured" : "not configured yet"}. The
            key itself is kept in secure server settings and is never shown here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voice</CardTitle>
        </CardHeader>
        <CardContent>
          <HankVoiceSettings
            canEdit={canEdit}
            saved={{ ...HANK_VOICE_DEFAULTS, ...(data?.voice ?? {}) }}
            model={data?.voiceModel ?? ""}
            configured={Boolean(data?.voiceConfigured)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="opacity-70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Usage &amp; cost <Badge variant="outline">Coming soon</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Reliable usage figures are not available yet, so nothing is shown rather than an
              estimate.
            </p>
          </CardContent>
        </Card>
      </div>

      {status && (
        <p
          className={`flex items-center gap-2 text-sm ${status.ok ? "text-primary" : "font-medium text-destructive"}`}
        >
          {!status.ok && <TriangleAlert className="h-4 w-4" />} {status.message}
        </p>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={submit} disabled={saving || personalityOver} className="rounded-xl">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Hank settings
          </Button>
        </div>
      )}
    </div>
  );
}

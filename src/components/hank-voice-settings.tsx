/**
 * Hank Settings → Voice. Hank's voice control centre.
 *
 * The ElevenLabs account key is never shown or entered here; the voice list,
 * the test sample and every spoken answer are produced by server functions.
 * Previewing a voice never changes Hank's active voice — that only happens
 * when the change is saved.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Loader2,
  Lock,
  Mic,
  Play,
  RefreshCw,
  Search,
  Square,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listHankVoices, saveHankVoiceSettings, testHankVoice } from "@/lib/voice.functions";
import {
  HANK_VOICE_DEFAULTS,
  HANK_VOICE_LIMITS,
  HANK_VOICE_TEST_PHRASE,
  HANK_VOICE_TUNING_DEFAULTS,
  HANK_WAKE_DEFAULT_PHRASE,
  HANK_WAKE_PHRASE_LIMITS,
  HANK_WAKE_TIMEOUT_LIMITS,
  type HankVoiceOption,
  type HankVoiceSettings,
} from "@/lib/ai/voice-config";

function voiceLabels(voice: HankVoiceOption): string {
  return [voice.accent, voice.gender, voice.age].filter(Boolean).join(" • ");
}

export function HankVoiceSettings({
  canEdit,
  saved,
  model,
  configured,
}: {
  canEdit: boolean;
  saved: HankVoiceSettings;
  model: string;
  configured: boolean;
}) {
  const fetchVoices = useServerFn(listHankVoices);
  const save = useServerFn(saveHankVoiceSettings);
  const test = useServerFn(testHankVoice);
  const queryClient = useQueryClient();

  const [form, setForm] = useState<HankVoiceSettings>(saved ?? HANK_VOICE_DEFAULTS);
  const [search, setSearch] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [phrase, setPhrase] = useState(HANK_VOICE_TEST_PHRASE);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => setForm(saved ?? HANK_VOICE_DEFAULTS), [saved]);
  useEffect(() => () => audioRef.current?.pause(), []);

  const voicesQuery = useQuery({
    queryKey: ["hank-voices"],
    queryFn: () => fetchVoices(),
    enabled: canEdit && configured,
    staleTime: 5 * 60 * 1000,
  });

  const voices: HankVoiceOption[] = voicesQuery.data?.voices ?? [];
  const listMessage = voicesQuery.data?.ok === false ? voicesQuery.data.message : null;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return voices;
    return voices.filter((voice) =>
      [voice.name, voice.category, voice.accent, voice.gender, voice.age, voice.description, voice.useCase]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [voices, search]);

  const selected = voices.find((voice) => voice.voiceId === form.voiceId) ?? null;
  const savedVoiceMissing =
    Boolean(form.voiceId) && voices.length > 0 && !voices.some((voice) => voice.voiceId === form.voiceId);

  const set = <K extends keyof HankVoiceSettings>(key: K, value: HankVoiceSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function stopAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }

  function playUrl(url: string) {
    stopAudio();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => {
      setSpeaking(false);
      setStatus({ ok: false, message: "That sample would not play on this device." });
    };
    setSpeaking(true);
    void audio.play().catch(() => {
      setSpeaking(false);
      setStatus({ ok: false, message: "That sample would not play on this device." });
    });
  }

  async function speakTest() {
    if (!form.voiceId) {
      setStatus({ ok: false, message: "Choose a voice first." });
      return;
    }
    setBusy("test");
    setStatus(null);
    try {
      const result = await test({
        data: {
          text: phrase,
          voiceId: form.voiceId,
          speed: form.speed,
          stability: form.stability,
          similarity: form.similarity,
          style: form.style,
          speakerBoost: form.speakerBoost,
        },
      });
      if (!result.ok || !("audioBase64" in result)) {
        setStatus({ ok: false, message: result.message ?? "That sample could not be produced." });
        return;
      }
      playUrl(`data:${result.mimeType};base64,${result.audioBase64}`);
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : "That sample could not be produced." });
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setBusy("save");
    setStatus(null);
    try {
      await save({
        data: {
          enabled: form.enabled,
          autoSpeak: form.autoSpeak,
          voiceId: form.voiceId,
          voiceName: selected?.name ?? form.voiceName,
          speed: form.speed,
          stability: form.stability,
          similarity: form.similarity,
          style: form.style,
          speakerBoost: form.speakerBoost,
          inputMode: form.inputMode,
          autoListen: form.autoListen,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      setStatus({ ok: true, message: "Saved. Hank uses this voice from his next answer on." });
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : "That could not be saved." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {!canEdit && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Only the owner and admins can change Hank's voice. You can still tap the
          speaker on any of his answers.
        </p>
      )}

      {!configured && (
        <p className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
          <TriangleAlert className="h-3.5 w-3.5" /> The voice account is not connected yet, so Hank cannot speak.
          Everything else about him keeps working.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" /> Hank's voice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Enable Hank Voice</p>
              <p className="text-xs text-muted-foreground">Adds a speaker button to each of Hank's answers.</p>
            </div>
            <Switch
              checked={form.enabled}
              disabled={!canEdit}
              aria-label="Enable Hank Voice"
              onCheckedChange={(value) => set("enabled", value)}
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Auto-speak responses</p>
              <p className="text-xs text-muted-foreground">
                Reads out each new answer as it arrives. Older messages in a conversation are never read out on their
                own.
              </p>
            </div>
            <Switch
              checked={form.autoSpeak}
              disabled={!canEdit || !form.enabled}
              aria-label="Auto-speak responses"
              onCheckedChange={(value) => set("autoSpeak", value)}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Mic className="h-3.5 w-3.5" /> Voice Mode input
              </p>
              <p className="text-xs text-muted-foreground">
                How the microphone works when someone taps the voice button beside the message box.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  { key: "auto", label: "Automatic conversation", hint: "Hank listens whenever he is not talking." },
                  { key: "push", label: "Push-to-talk", hint: "Hold the microphone to speak. Better in a noisy bay." },
                  { key: "wake", label: "Wake word", hint: "He waits quietly until he hears his phrase." },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => set("inputMode", option.key)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    form.inputMode === option.key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted"
                  } ${canEdit ? "" : "opacity-60"}`}
                >
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.hint}</span>
                </button>
              ))}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Auto-start listening</p>
                <p className="text-xs text-muted-foreground">
                  Starts listening as soon as Voice Mode opens, and again after each answer.
                </p>
              </div>
              <Switch
                checked={form.autoListen}
                disabled={!canEdit || form.inputMode !== "auto"}
                aria-label="Auto-start listening"
                onCheckedChange={(value) => set("autoListen", value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Mic className="h-3.5 w-3.5" /> Wake word
                </p>
                <p className="text-xs text-muted-foreground">
                  Hands-free start. In Voice Mode he waits quietly, then perks up when he hears his phrase.
                </p>
              </div>
              <Switch
                checked={form.wakeEnabled}
                disabled={!canEdit}
                aria-label="Enable wake word"
                onCheckedChange={(value) => {
                  set("wakeEnabled", value);
                  if (value) set("inputMode", "wake");
                }}
              />
            </div>

            {form.wakeEnabled && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wake-phrase" className="text-xs">
                    Wake phrase
                  </Label>
                  <Input
                    id="wake-phrase"
                    value={form.wakePhrase}
                    disabled={!canEdit}
                    maxLength={HANK_WAKE_PHRASE_LIMITS.max}
                    placeholder={HANK_WAKE_DEFAULT_PHRASE}
                    onChange={(event) => set("wakePhrase", event.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Two or three words work best — “Hey Hank”, “Okay Hank”. A single short word is triggered more often
                    by ordinary shop talk.
                  </p>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Activation sound</p>
                    <p className="text-xs text-muted-foreground">A short chime when he starts listening.</p>
                  </div>
                  <Switch
                    checked={form.wakeSound}
                    disabled={!canEdit}
                    aria-label="Activation sound"
                    onCheckedChange={(value) => set("wakeSound", value)}
                  />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Activation response</p>
                    <p className="text-xs text-muted-foreground">
                      He answers with a quick “Yeah?” in his own voice before you ask.
                    </p>
                  </div>
                  <Switch
                    checked={form.wakeResponse}
                    disabled={!canEdit}
                    aria-label="Activation response"
                    onCheckedChange={(value) => set("wakeResponse", value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Conversation timeout</Label>
                    <span className="text-xs text-muted-foreground">{form.wakeTimeoutSeconds}s</span>
                  </div>
                  <Slider
                    value={[form.wakeTimeoutSeconds]}
                    min={HANK_WAKE_TIMEOUT_LIMITS.min}
                    max={HANK_WAKE_TIMEOUT_LIMITS.max}
                    step={HANK_WAKE_TIMEOUT_LIMITS.step}
                    disabled={!canEdit}
                    onValueChange={([value]) => set("wakeTimeoutSeconds", value ?? HANK_WAKE_TIMEOUT_LIMITS.min)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    After this much quiet he stops the conversation and waits for the phrase again.
                  </p>
                </div>

                <p className="rounded-lg border border-border bg-card p-2.5 text-[11px] text-muted-foreground">
                  Wake word listening happens on this device using the browser's own listening feature, so room audio is
                  never sent to Hank's answering or speaking services just to catch his name. It works while Voice Mode
                  is open in Chrome or Edge on a desktop, laptop or phone. A web page cannot listen in the background,
                  after the tab is closed, or while the device is asleep — that needs a future installed Windows or phone
                  version. He also ignores the phrase while he is talking, so his own voice cannot set him off.
                </p>
              </div>
            )}
          </div>



          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Currently selected</p>
            <p className="text-sm font-semibold">
              {selected?.name ?? form.voiceName ?? "No voice chosen yet"}
            </p>
            {selected && <p className="text-xs text-muted-foreground">{voiceLabels(selected) || selected.category}</p>}
            {savedVoiceMissing && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-destructive">
                <TriangleAlert className="h-3.5 w-3.5" /> This voice is no longer in the ElevenLabs account. Pick another
                one — Hank has not been switched for you.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hank-speed">Speaking speed — {form.speed.toFixed(2)}×</Label>
            <Slider
              id="hank-speed"
              disabled={!canEdit}
              min={HANK_VOICE_LIMITS.speed.min}
              max={HANK_VOICE_LIMITS.speed.max}
              step={HANK_VOICE_LIMITS.speed.step}
              value={[form.speed]}
              onValueChange={([value]) => set("speed", value ?? 1)}
            />
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>Choose a voice</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={!configured || voicesQuery.isFetching}
                onClick={() => void voicesQuery.refetch()}
              >
                {voicesQuery.isFetching ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                )}
                Refresh voices
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voices by name, accent or age"
                className="pl-9"
                aria-label="Search voices"
              />
            </div>

            {listMessage && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <TriangleAlert className="h-3.5 w-3.5" /> {listMessage}
              </p>
            )}
            {voicesQuery.isLoading && <p className="text-xs text-muted-foreground">Loading voices…</p>}

            <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
              {filtered.map((voice) => {
                const active = voice.voiceId === form.voiceId;
                return (
                  <div
                    key={voice.voiceId}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                      active ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{voice.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {voiceLabels(voice) || voice.description || voice.category || "—"}
                      </p>
                      {voice.category && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {voice.category}
                        </Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {voice.previewUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          aria-label={`Preview ${voice.name}`}
                          onClick={() => playUrl(voice.previewUrl as string)}
                        >
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant={active ? "secondary" : "default"}
                        size="sm"
                        className="rounded-xl"
                        onClick={() => {
                          set("voiceId", voice.voiceId);
                          set("voiceName", voice.name);
                        }}
                      >
                        {active ? "Selected" : "Select"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!voicesQuery.isLoading && filtered.length === 0 && !listMessage && (
                <p className="text-xs text-muted-foreground">No voices match that search.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Test Hank's voice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} aria-label="Test phrase" />
            <div className="flex items-center gap-2">
              <Button type="button" onClick={speakTest} disabled={busy === "test" || !configured} className="rounded-xl">
                {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Speak
              </Button>
              {speaking && (
                <Button type="button" variant="outline" onClick={stopAudio} className="rounded-xl">
                  <Square className="mr-2 h-3.5 w-3.5" /> Stop
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Uses the voice, speed and advanced settings shown here, saved or not, so you can try before you save.
            </p>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>
              <button
                type="button"
                onClick={() => setAdvanced((prev) => !prev)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                Advanced voice settings
                <ChevronDown className={`h-4 w-4 transition-transform ${advanced ? "rotate-180" : ""}`} />
              </button>
            </CardTitle>
          </CardHeader>
          {advanced && (
            <CardContent className="space-y-5">
              {(
                [
                  ["stability", "Stability", "Lower is more expressive, higher is steadier."],
                  ["similarity", "Similarity", "How closely Hank sticks to the original voice."],
                  ["style", "Style", "Extra style emphasis. Leave low for everyday shop talk."],
                ] as const
              ).map(([key, label, hint]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`hank-${key}`}>
                    {label} — {form[key].toFixed(2)}
                  </Label>
                  <Slider
                    id={`hank-${key}`}
                    min={HANK_VOICE_LIMITS[key].min}
                    max={HANK_VOICE_LIMITS[key].max}
                    step={HANK_VOICE_LIMITS[key].step}
                    value={[form[key]]}
                    onValueChange={([value]) => set(key, value ?? 0)}
                  />
                  <p className="text-[11px] text-muted-foreground">{hint}</p>
                </div>
              ))}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Speaker boost</p>
                  <p className="text-xs text-muted-foreground">Clearer, slightly closer to the original voice.</p>
                </div>
                <Switch
                  checked={form.speakerBoost}
                  aria-label="Speaker boost"
                  onCheckedChange={(value) => set("speakerBoost", value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    speed: HANK_VOICE_TUNING_DEFAULTS.speed,
                    stability: HANK_VOICE_TUNING_DEFAULTS.stability,
                    similarity: HANK_VOICE_TUNING_DEFAULTS.similarity,
                    style: HANK_VOICE_TUNING_DEFAULTS.style,
                    speakerBoost: HANK_VOICE_TUNING_DEFAULTS.speakerBoost,
                  }))
                }
              >
                Reset to voice defaults
              </Button>
              <p className="text-[11px] text-muted-foreground">Speech model in use: {model}.</p>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" /> Talking to Hank <Badge variant="outline">Voice Mode</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            With Hank Voice on, the voice button beside the message box opens Voice Mode. It works with a desktop or
            phone microphone and with Bluetooth headsets — the browser and device choose the microphone as usual.
          </p>
        </CardContent>
      </Card>


      {status && (
        <p className={`flex items-center gap-2 text-sm ${status.ok ? "text-primary" : "font-medium text-destructive"}`}>
          {!status.ok && <TriangleAlert className="h-4 w-4" />} {status.message}
        </p>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy === "save"} className="rounded-xl">
            {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
          </Button>
        </div>
      )}
    </div>
  );
}

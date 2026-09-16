import { useState } from "react";
import { Check, CircleHelp, Pencil, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DetectedProposalView } from "@/lib/shop-ai.functions";

/**
 * "Detected information" preview for anything Hank read out of an image.
 * Nothing has been written yet: the user confirms, edits or cancels, and the
 * chosen answer is sent back as the next message so the approved action tools run.
 */
export function DetectedCard({
  proposal,
  disabled,
  onRespond,
}: {
  proposal: DetectedProposalView;
  disabled?: boolean;
  onRespond: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => asEditableText(proposal));

  const unclear = proposal.records.flatMap((record) =>
    record.fields.filter((field) => field.confidence !== "clear"),
  );

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="border-b border-border bg-muted/50 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detected information</p>
        <p className="font-display text-sm font-bold text-foreground">{proposal.title}</p>
        <p className="text-[11px] text-muted-foreground">Nothing is saved until you confirm.</p>
      </div>

      <div className="space-y-3 p-4">
        {proposal.records.map((record, index) => (
          <div key={`${record.tool}-${index}`} className="rounded-xl border border-border/70 bg-background p-3">
            <p className="mb-2 text-xs font-semibold text-foreground">
              {record.label ?? record.tool.replace(/_/g, " ")}
            </p>
            <dl className="space-y-1">
              {record.fields.map((field) => (
                <div key={field.label} className="flex items-start justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="text-right font-medium text-foreground">
                    {field.value ?? <span className="text-destructive">Could not read</span>}
                    {field.confidence === "uncertain" && (
                      <span className="ml-1.5 rounded-full bg-secondary/15 px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                        check
                      </span>
                    )}
                    {field.note && <span className="block text-[11px] font-normal text-muted-foreground">{field.note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}

        {proposal.warnings.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-[11px] text-destructive">
            {proposal.warnings.map((warning) => (
              <li key={warning} className="flex gap-1.5">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" /> {warning}
              </li>
            ))}
          </ul>
        )}

        {unclear.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {unclear.length} value{unclear.length === 1 ? "" : "s"} need a look before saving.
          </p>
        )}

        {proposal.question && (
          <p className="flex gap-1.5 rounded-xl bg-primary/5 p-3 text-xs font-medium text-foreground">
            <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {proposal.question}
          </p>
        )}

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={Math.min(14, draft.split("\n").length + 1)}
              aria-label="Correct the detected values"
              className="resize-none bg-muted/60 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={disabled}
                onClick={() => onRespond(`Use these corrected values and save them:\n${draft}`)}
                className="rounded-xl"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" /> Save corrected values
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="rounded-xl">
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={disabled}
              onClick={() =>
                onRespond(
                  `Confirmed. Save the detected information exactly as shown in the card titled "${proposal.title}".`,
                )
              }
              className="rounded-xl"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => setEditing(true)}
              className="rounded-xl"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => onRespond("Cancel that — do not save anything from the screenshot.")}
              className="rounded-xl text-muted-foreground"
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Turns the card into plain editable lines the user can correct. */
function asEditableText(proposal: DetectedProposalView) {
  return proposal.records
    .map((record) => {
      const heading = record.label ?? record.tool.replace(/_/g, " ");
      const lines = record.fields.map((field) => `${field.label}: ${field.value ?? ""}`);
      return [heading, ...lines].join("\n");
    })
    .join("\n\n");
}

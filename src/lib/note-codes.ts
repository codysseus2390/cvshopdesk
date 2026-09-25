/**
 * TireShop note codes shown on the TV board's customer cards.
 *
 * A job's note text (the same freeform text already shown as `requested_service` —
 * Autoflow visit descriptions, deduped and joined with " · " per individual note,
 * see autoflow-descriptions.server.ts) can start with a staff shorthand code:
 *
 *   W  -> WAITING
 *   DO -> DROP OFF
 *   TO -> TIRE ONLY
 *
 * A code is only recognized at the very start of an individual note (a `·`-separated
 * segment), and only when followed by a space, colon, dash, or the end of that note —
 * so "W tire install" and "W: tire install" match but "Wheel bearing noise" and
 * "DOOR seal replaced" do not. Multiple codes can lead the same note ("W TO tire
 * install"), and codes can also lead separate notes independently.
 */

export type NoteCode = "W" | "DO" | "TO";
export type NoteLabel = "WAITING" | "DROP_OFF" | "TIRE_ONLY";

export const NOTE_LABEL_TEXT: Record<NoteLabel, string> = {
  WAITING: "WAITING",
  DROP_OFF: "DROP OFF",
  TIRE_ONLY: "TIRE ONLY",
};

/** CSS class / data-attribute suffix for each label, lowest-kebab-case. */
export const NOTE_LABEL_SLUG: Record<NoteLabel, string> = {
  WAITING: "waiting",
  DROP_OFF: "drop-off",
  TIRE_ONLY: "tire-only",
};

const CODE_TO_LABEL: Record<NoteCode, NoteLabel> = {
  W: "WAITING",
  DO: "DROP_OFF",
  TO: "TIRE_ONLY",
};

// Longest codes first so "DO"/"TO" are tried before the single-letter "W".
const CODES: NoteCode[] = ["DO", "TO", "W"];
const TERMINATORS = new Set([" ", ":", "-"]);

/** The leading codes on a single `·`-separated note segment (order not significant). */
function leadingCodes(segment: string): Set<NoteCode> {
  let text = segment.trimStart();
  const found = new Set<NoteCode>();
  let matchedThisPass = true;
  while (matchedThisPass) {
    matchedThisPass = false;
    for (const code of CODES) {
      if (!text.startsWith(code)) continue;
      const next = text[code.length];
      if (next !== undefined && !TERMINATORS.has(next)) continue;
      found.add(code);
      text = next === undefined ? "" : text.slice(code.length + 1);
      matchedThisPass = true;
      break;
    }
  }
  return found;
}

/**
 * Parses every code across all `·`-separated notes in a job's note text and returns
 * the labels to display, in fixed display order (WAITING or DROP OFF, then TIRE ONLY).
 * Conflicting W and DO codes anywhere in the text suppress both of those labels —
 * TIRE ONLY still shows on its own if TO is present. An unmarked note (or a note with
 * no text at all) returns no labels. The original note text is never modified.
 */
export function parseNoteLabels(noteText: string | null | undefined): NoteLabel[] {
  if (!noteText) return [];
  const codes = new Set<NoteCode>();
  for (const segment of noteText.split("·")) {
    for (const code of leadingCodes(segment)) codes.add(code);
  }

  const labels: NoteLabel[] = [];
  const hasWaiting = codes.has("W");
  const hasDropOff = codes.has("DO");
  if (hasWaiting && !hasDropOff) labels.push(CODE_TO_LABEL.W);
  else if (hasDropOff && !hasWaiting) labels.push(CODE_TO_LABEL.DO);
  if (codes.has("TO")) labels.push(CODE_TO_LABEL.TO);
  return labels;
}

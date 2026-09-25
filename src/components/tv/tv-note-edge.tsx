import { Fragment } from "react";
import { NOTE_LABEL_SLUG, NOTE_LABEL_TEXT, type NoteLabel } from "@/lib/note-codes";

/**
 * The card's top edge line, broken by one or two note-code words:
 *   ──── WAITING ────
 *   ── WAITING ── TIRE ONLY ──
 * Renders nothing when there are no labels, leaving the card's plain edge as-is.
 */
export function TvNoteEdge({ labels }: { labels: NoteLabel[] }) {
  const [firstLabel] = labels;
  if (!firstLabel) return null;
  return (
    <div className="tv-note-edge" data-count={labels.length}>
      <span
        className="tv-note-edge-line"
        data-color={NOTE_LABEL_SLUG[firstLabel]}
        aria-hidden="true"
      />
      {labels.map((label) => (
        <Fragment key={label}>
          <span className={`tv-note-label tv-note-label--${NOTE_LABEL_SLUG[label]}`}>
            {NOTE_LABEL_TEXT[label]}
          </span>
          <span
            className="tv-note-edge-line"
            data-color={NOTE_LABEL_SLUG[label]}
            aria-hidden="true"
          />
        </Fragment>
      ))}
    </div>
  );
}

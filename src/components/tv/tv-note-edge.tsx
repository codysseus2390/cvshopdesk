import { NOTE_LABEL_SLUG, NOTE_LABEL_TEXT, type NoteLabel } from "@/lib/note-codes";

/**
 * The card's own top edge, glowing in the note-code color(s), with the word
 * sitting flush in the middle of that glow — no separate badge/pill/lines.
 * One label glows the full edge; two split it into two colored halves.
 * Renders nothing when there are no labels, leaving the card's plain edge as-is.
 */
export function TvNoteEdge({ labels }: { labels: NoteLabel[] }) {
  if (labels.length === 0) return null;
  return (
    <div className="tv-note-edge" data-count={labels.length}>
      {labels.map((label) => (
        <span
          key={label}
          className={`tv-note-edge-segment tv-note-edge-segment--${NOTE_LABEL_SLUG[label]}`}
        >
          <span className={`tv-note-label tv-note-label--${NOTE_LABEL_SLUG[label]}`}>
            {NOTE_LABEL_TEXT[label]}
          </span>
        </span>
      ))}
    </div>
  );
}

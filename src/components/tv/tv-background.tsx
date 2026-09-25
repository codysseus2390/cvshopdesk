/** Brushed dark surface shared by both screens — a restrained, static texture, no sweeping lights. */
export function TvBackground() {
  return (
    <div className="tv-carbon" aria-hidden="true">
      <div className="tv-ambient-glow" />
    </div>
  );
}

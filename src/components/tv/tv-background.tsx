/** Decorative carbon surface and drifting light trails shared by both screens. */
export function TvBackground() {
  return (
    <div className="tv-carbon" aria-hidden="true">
      <div className="tv-ambient-glow" />
      <div className="tv-light-trail tv-light-trail-one" />
      <div className="tv-light-trail tv-light-trail-two" />
      <div className="tv-light-trail tv-light-trail-three" />
      <div className="tv-light-trail tv-light-trail-four" />
    </div>
  );
}

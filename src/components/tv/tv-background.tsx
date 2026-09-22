/**
 * The shared TV surface: brushed shop metal with a sheen travelling across the
 * grain, two machined discs turning at different speeds, and the overhead shop
 * light drifting. Purely decorative — it sits behind everything at z-0 and the
 * UI renders above it. All of the motion is CSS, so the global
 * prefers-reduced-motion rule switches it off for free.
 */
export function TvBackground() {
  return (
    <div className="tv-metal" aria-hidden="true">
      <div className="tv-metal-disc" />
      <div className="tv-metal-disc tv-metal-disc-alt" />
      <div className="tv-metal-sheen" />
      <div className="tv-metal-glow" />
      <div className="tv-metal-grain" />
      <div className="tv-metal-vignette" />
    </div>
  );
}

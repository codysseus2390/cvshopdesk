/**
 * Unmistakable "this is not real data" marker for /tv-demo. Sits above the
 * real TV layout, never rendered on /tv, never shipped to a Production build
 * (the route itself is gated — see routes/_authenticated/tv-demo.tsx).
 */
export function TvDemoBanner() {
  return (
    <div className="tv-demo-banner" role="status">
      <span className="tv-demo-banner-dot" aria-hidden="true" />
      DEMO DATA — every name, time, and total on this screen is a synthetic example, not a real
      customer or a real shop total
    </div>
  );
}

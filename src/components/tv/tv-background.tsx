import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TvSceneHandle } from "./tv-scene";

/**
 * The shared TV surface: brushed shop metal, with the three.js shop scene
 * (turning tires, neon streaks, rolling floor, embers — see `tv-scene.ts`)
 * layered over it once WebGL is up. Until then, or if WebGL is unavailable or
 * the context is lost, the original CSS metal — sheen, machined discs, drifting
 * shop light — carries on by itself, so the screen is never blank.
 *
 * Purely decorative: it sits behind everything at z-0 and the UI renders above
 * it. With prefers-reduced-motion the 3D scene draws one still frame and the
 * global CSS rule stills everything else.
 */
export function TvBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: TvSceneHandle | null = null;
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    import("./tv-scene")
      .then(({ createTvScene }) => {
        if (cancelled) return;
        try {
          handle = createTvScene(canvas, { reducedMotion, onContextLost: () => setLive(false) });
          setLive(true);
        } catch {
          // No WebGL on this display — the CSS metal underneath stays as is.
        }
      })
      .catch(() => {
        // Chunk failed to load (offline TV, stale deploy) — same fallback.
      });

    return () => {
      cancelled = true;
      handle?.dispose();
    };
  }, []);

  return (
    <div className={cn("tv-metal", live && "tv-metal-3d")} aria-hidden="true">
      <div className="tv-metal-disc" />
      <div className="tv-metal-disc tv-metal-disc-alt" />
      <div className="tv-metal-sheen" />
      <div className="tv-metal-glow" />
      <canvas ref={canvasRef} className="tv-scene" />
      <div className="tv-metal-grain" />
      <div className="tv-metal-vignette" />
    </div>
  );
}

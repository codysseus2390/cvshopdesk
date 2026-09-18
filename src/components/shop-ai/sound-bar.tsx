/**
 * Hank's voice bar — the one visual used in Voice Mode.
 *
 * Deliberately plain: rounded vertical bars on a small canvas, taller in the
 * middle, drawn in the app's own accent colour. While someone is talking, or
 * while Hank is talking, the bars follow the real loudness of that audio, which
 * the caller supplies through `getLevel`. Nothing here records or keeps audio.
 *
 * One canvas and one animation frame, so it stays cheap on a shop tablet, and it
 * holds still for anyone who has asked their device to reduce motion.
 */
import { useEffect, useRef } from "react";

export type SoundBarMode = "idle" | "listening" | "thinking" | "speaking";

const BARS = 28;

/** Centre bars are tallest, outer bars shortest. */
function shape(index: number): number {
  const middle = (BARS - 1) / 2;
  const distance = Math.abs(index - middle) / middle;
  return 0.28 + 0.72 * Math.cos((distance * Math.PI) / 2) ** 1.4;
}

function themeColor(element: HTMLElement, variable: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(variable).trim();
  return value ? `var(${variable})` : fallback;
}

export function SoundBar({
  mode,
  getLevel,
  className,
}: {
  mode: SoundBarMode;
  /** Current loudness of the live audio, 0-1. */
  getLevel: () => number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef(mode);
  const levelRef = useRef(getLevel);
  modeRef.current = mode;
  levelRef.current = getLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const accent = themeColor(canvas, "--primary", "#e07a1f");
    const heights = new Array<number>(BARS).fill(0.06);
    let frame = 0;
    let raf: number | null = null;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      context.clearRect(0, 0, width, height);

      const current = modeRef.current;
      const live = current === "listening" || current === "speaking";
      const level = live ? Math.min(1, Math.max(0, levelRef.current())) : 0;
      frame += 1;

      const gap = Math.max(2, width / (BARS * 5));
      const barWidth = Math.max(2, (width - gap * (BARS - 1)) / BARS);
      const radius = barWidth / 2;

      for (let i = 0; i < BARS; i += 1) {
        const form = shape(i);
        let target: number;
        if (still) {
          target = 0.18 * form + (live ? level * 0.5 * form : 0);
        } else if (live) {
          // Live audio: loudness sets the height, with a little per-bar life so
          // it reads as a voice rather than a single block moving up and down.
          const wobble = 0.72 + 0.28 * Math.sin(frame * 0.22 + i * 0.9);
          target = 0.07 + level * 1.05 * form * wobble;
        } else if (current === "thinking") {
          // A calm travelling wave — clearly not live sound.
          target = 0.14 + 0.2 * form * (0.5 + 0.5 * Math.sin(frame * 0.06 - i * 0.42));
        } else {
          target = 0.06 + 0.035 * form * (0.5 + 0.5 * Math.sin(frame * 0.02 - i * 0.3));
        }
        target = Math.min(1, target);
        const previous = heights[i] ?? 0;
        const ease = target > previous ? 0.45 : 0.16;
        const next = previous + (target - previous) * ease;
        heights[i] = next;

        const barHeight = Math.max(barWidth, next * height);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        context.globalAlpha = 0.35 + 0.65 * Math.min(1, next * 2.2);
        context.fillStyle = accent;
        if (typeof context.roundRect === "function") {
          context.beginPath();
          context.roundRect(x, y, barWidth, barHeight, radius);
          context.fill();
        } else {
          context.fillRect(x, y, barWidth, barHeight);
        }
      }
      context.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener("resize", resize);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className ?? "h-24 w-full max-w-sm"}
      style={{
        filter: "drop-shadow(0 2px 10px color-mix(in oklab, var(--primary) 25%, transparent))",
      }}
    />
  );
}

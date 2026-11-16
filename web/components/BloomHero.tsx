"use client";

import { useEffect, useRef } from "react";

const CELL = 12;

// cheap, stable per-cell random number in [0, 1)
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** The reference video rebuilt in code: white square pixels blooming on a dot grid. */
export default function BloomHero({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (seconds: number) => {
      ctx.clearRect(0, 0, width, height);
      const cols = Math.ceil(width / CELL);
      const rows = Math.ceil(height / CELL);
      const cx = width / 2;
      const cy = height / 2;
      const reach = Math.min(width * 0.46, height * 0.62);
      const grow = reduce ? 1 : 1 - Math.pow(1 - Math.min(1, seconds / 5), 3);
      const breathe = reduce ? 0 : Math.sin(seconds * 0.6) * 0.03;
      const drift = reduce ? 0 : seconds * 0.05;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * CELL + CELL / 2;
          const y = row * CELL + CELL / 2;
          const dx = (x - cx) / reach;
          const dy = ((y - cy) / reach) * 1.25;
          const r = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx);

          // three overlapping rings of petals
          const petals =
            0.5 +
            0.3 * Math.pow(Math.abs(Math.cos(2.5 * angle + drift)), 1.6) +
            0.22 * Math.pow(Math.abs(Math.cos(3.5 * angle - drift * 1.4 + 1.1)), 2.4) +
            0.08 * Math.sin(9 * angle + drift * 3);
          const boundary = (grow + breathe) * petals;
          const noise = hash(col, row);
          const inside = smooth(0, 0.16, boundary - r + (noise - 0.5) * 0.12);

          if (inside <= 0.02) {
            // background dot, occasionally a slightly brighter one
            ctx.fillStyle = noise > 0.93 ? "#4a4a4a" : "#1c1c1c";
            ctx.fillRect(x - 1, y - 1, 2, 2);
            continue;
          }
          const core = 1 - Math.min(1, r / Math.max(boundary, 0.001));
          const size = Math.max(2, (CELL - 3) * inside * (0.55 + 0.45 * core + 0.15 * noise));
          const shade = Math.round(255 * Math.min(1, 0.5 + 0.5 * inside + 0.2 * core));
          ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
    };

    const start = performance.now();
    const loop = (now: number) => {
      draw((now - start) / 1000);
      frame = requestAnimationFrame(loop);
    };

    resize();
    if (reduce) draw(10);
    else frame = requestAnimationFrame(loop);
    const observer = new ResizeObserver(() => {
      resize();
      if (reduce) draw(10);
    });
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}

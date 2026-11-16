"use client";

import { useEffect, useRef } from "react";

export type Series = Record<string, [number, number][]>;

const SHADES = ["#ffffff", "#7cffb2", "#ff5c7a", "#8ab4ff", "#ffd166", "#9a9a9a"];

export default function LossChart({ title, series }: { title: string; series: Series }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const names = Object.keys(series);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const points = Object.values(series).flat();
      const pad = { l: 44, r: 8, t: 8, b: 20 };
      ctx.strokeStyle = "#242424";
      ctx.strokeRect(pad.l + 0.5, pad.t + 0.5, w - pad.l - pad.r, h - pad.t - pad.b);
      if (points.length === 0) return;

      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of points) {
        if (!Number.isFinite(y)) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      if (!Number.isFinite(y0)) return;
      if (x1 === x0) x1 = x0 + 1;
      if (y1 === y0) { y1 += 0.5; y0 -= 0.5; }
      const span = y1 - y0;
      y0 -= span * 0.05; y1 += span * 0.05;
      const px = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (w - pad.l - pad.r);
      const py = (y: number) => pad.t + (1 - (y - y0) / (y1 - y0)) * (h - pad.t - pad.b);

      ctx.font = "10px ui-monospace, monospace";
      ctx.fillStyle = "#8f8f8f";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= 2; i++) {
        const value = y0 + ((y1 - y0) * i) / 2;
        ctx.fillText(value.toPrecision(3), pad.l - 6, py(value));
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(Math.round(x0)), pad.l, h - pad.b + 5);
      ctx.fillText(`step ${Math.round(x1)}`, w - pad.r - 24, h - pad.b + 5);

      Object.entries(series).forEach(([, data], i) => {
        const shade = SHADES[i % SHADES.length];
        ctx.strokeStyle = shade;
        ctx.fillStyle = shade;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        for (const [x, y] of data) {
          if (!Number.isFinite(y)) continue;
          if (started) ctx.lineTo(px(x), py(y));
          else { ctx.moveTo(px(x), py(y)); started = true; }
        }
        ctx.stroke();
        if (data.length <= 60) for (const [x, y] of data) if (Number.isFinite(y)) ctx.fillRect(px(x) - 2, py(y) - 2, 4, 4);
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [series]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2">
        <span className="label">{title}</span>
        {names.map((name, i) => {
          const data = series[name];
          const last = data[data.length - 1]?.[1];
          return (
            <span key={name} className="flex items-center gap-1 font-mono text-[11px] text-white/80">
              <span className="inline-block h-2 w-2" style={{ background: SHADES[i % SHADES.length] }} />
              {name}
              {typeof last === "number" && <span className="text-dim">{last.toFixed(3)}</span>}
            </span>
          );
        })}
      </div>
      <canvas ref={ref} className="min-h-0 w-full flex-1" role="img" aria-label={`${title} chart`} />
    </div>
  );
}

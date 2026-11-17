"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef, useState, type DependencyList, type ReactNode } from "react";

export const POS = "#7cffb2";
export const NEG = "#ff5c7a";
export const DIM = "#8f8f8f";
export const LINE = "#242424";
export const MONO = "11px ui-monospace, Consolas, monospace";

/** A canvas that redraws when `deps` change or its box resizes. */
export function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, deps: DependencyList) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const render = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 2 || h < 2) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h);
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export type Plot = {
  px: (x: number) => number;
  py: (y: number) => number;
  x0: number; x1: number; y0: number; y1: number;
  left: number; right: number; top: number; bottom: number;
};

/** Axes box with min/max labels. Returns functions that map data to pixels. */
export function plot(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  xr: [number, number], yr: [number, number],
  labels?: { x?: string; y?: string },
): Plot {
  const left = 40, right = w - 10, top = 10, bottom = h - 24;
  const [x0, x1] = xr, [y0, y1] = yr;
  const px = (x: number) => left + ((x - x0) / (x1 - x0)) * (right - left);
  const py = (y: number) => bottom - ((y - y0) / (y1 - y0)) * (bottom - top);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 0.5, top + 0.5, right - left, bottom - top);
  ctx.font = MONO;
  ctx.fillStyle = DIM;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillText(String(y1), left - 6, top + 4);
  ctx.fillText(String(y0), left - 6, bottom - 4);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(String(x0), left, bottom + 6);
  ctx.textAlign = "right";
  ctx.fillText(String(x1), right, bottom + 6);
  ctx.textAlign = "center";
  if (labels?.x) ctx.fillText(labels.x, (left + right) / 2, bottom + 6);
  if (labels?.y) {
    ctx.save();
    ctx.translate(12, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(labels.y, 0, 0);
    ctx.restore();
  }
  return { px, py, x0, x1, y0, y1, left, right, top, bottom };
}

export function curve(ctx: CanvasRenderingContext2D, p: Plot, f: (x: number) => number, color = "#fff", width = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(p.left, p.top, p.right - p.left, p.bottom - p.top);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const x = p.x0 + ((p.x1 - p.x0) * i) / steps;
    const y = Math.max(p.y0 - (p.y1 - p.y0), Math.min(p.y1 + (p.y1 - p.y0), f(x)));
    if (i === 0) ctx.moveTo(p.px(x), p.py(y));
    else ctx.lineTo(p.px(x), p.py(y));
  }
  ctx.stroke();
  ctx.restore();
}

export function square(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, hollow = false) {
  if (hollow) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
}

/** Small deterministic random generator so every visit shows the same data. */
export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(next() + 1e-12)) * Math.cos(2 * Math.PI * next());
  return { next, normal };
}

export function Slider({
  label, value, min, max, step, onChange, format,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (value: number) => void; format?: (value: number) => string;
}) {
  return (
    <label className="flex min-w-[9rem] flex-1 flex-col gap-1">
      <span className="flex justify-between font-mono text-[11px] uppercase tracking-wider text-dim">
        {label}
        <span className="text-white">{format ? format(value) : value}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-5 w-full cursor-pointer accent-white"
      />
    </label>
  );
}

export function Choice<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-wider text-dim">{label}</span>
      <div className="flex flex-wrap" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            aria-pressed={option === value}
            className={`border border-line px-2 py-1 font-mono text-[11px] uppercase tracking-wider ${
              option === value ? "border-white bg-white text-black" : "text-dim hover:text-white"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Readout({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[11px] uppercase tracking-wider text-dim">{label}</span>
      <span className={`font-mono text-lg tabular-nums ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

/** Standard scene layout: picture on top, controls underneath. */
export function Frame({ children, controls, tall }: { children: ReactNode; controls?: ReactNode; tall?: boolean }) {
  return (
    <div className="flex flex-col">
      <div className={`relative w-full ${tall ? "h-[26rem]" : "h-[22rem]"} max-h-[60vh] min-h-[16rem]`}>{children}</div>
      {controls && <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-line p-4">{controls}</div>}
    </div>
  );
}

/** A 3D canvas with drag-to-rotate, already set up for the theme. */
export function Stage3D({ children, camera = [5, 4, 6] }: { children: ReactNode; camera?: [number, number, number] }) {
  // The canvas can miss its first size measurement in development; nudge it.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timers = [50, 400].map((ms) =>
      setTimeout(() => {
        setTick((t) => t + 1);
        window.dispatchEvent(new Event("resize"));
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <Canvas camera={{ position: camera, fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={["#000000"]} />
      <OrbitControls enablePan={false} minDistance={3} maxDistance={30} />
      {children}
    </Canvas>
  );
}

export const BLUE = "#8ab4ff";
export const CLASS_COLORS = [POS, NEG, BLUE];

/** Fill the plot with dot-matrix pixels. `f` gets data coordinates and returns a size (0..1) and colour. */
export function dotMap(
  ctx: CanvasRenderingContext2D, p: Plot,
  f: (x: number, y: number) => { size: number; color: string } | null, cell = 12,
) {
  for (let px = p.left + cell / 2; px < p.right; px += cell) {
    for (let py = p.top + cell / 2; py < p.bottom; py += cell) {
      const x = p.x0 + ((px - p.left) / (p.right - p.left)) * (p.x1 - p.x0);
      const y = p.y1 - ((py - p.top) / (p.bottom - p.top)) * (p.y1 - p.y0);
      const dot = f(x, y);
      if (dot) square(ctx, px, py, 1.5 + Math.max(0, Math.min(1, dot.size)) * (cell - 4), dot.color);
    }
  }
}

/** Straight line a·x + b·y + c = 0 across the plot. */
export function line(ctx: CanvasRenderingContext2D, p: Plot, a: number, b: number, c: number, color = "#fff", dash: number[] = []) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(p.left, p.top, p.right - p.left, p.bottom - p.top);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = dash.length ? 1 : 2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  if (Math.abs(b) > Math.abs(a)) {
    ctx.moveTo(p.px(p.x0), p.py(-(a * p.x0 + c) / b));
    ctx.lineTo(p.px(p.x1), p.py(-(a * p.x1 + c) / b));
  } else if (a !== 0) {
    ctx.moveTo(p.px(-(b * p.y0 + c) / a), p.py(p.y0));
    ctx.lineTo(p.px(-(b * p.y1 + c) / a), p.py(p.y1));
  }
  ctx.stroke();
  ctx.restore();
}

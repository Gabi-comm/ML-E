"use client";

import { useEffect, useMemo, useState } from "react";
import { BLUE, Choice, DIM, Frame, NEG, POS, Readout, Slider, dotMap, plot, rng, square, useCanvas } from "./ui";

// ---------------------------------------------------------------- 1. vanishing / exploding gradients
const WIDTH = 40;
const ACTS = {
  sigmoid: { f: (z: number) => 1 / (1 + Math.exp(-z)), d: (a: number) => a * (1 - a) },
  tanh: { f: Math.tanh, d: (a: number) => 1 - a * a },
  relu: { f: (z: number) => Math.max(0, z), d: (a: number) => (a > 0 ? 1 : 0) },
} as const;
const INITS = { "plain random": () => 1, Glorot: () => Math.sqrt(1 / WIDTH), He: () => Math.sqrt(2 / WIDTH) } as const;

/** Push a signal forward through random layers, then push a gradient back, and measure both. */
function signalFlow(depth: number, act: keyof typeof ACTS, init: keyof typeof INITS) {
  const r = rng(depth * 31 + act.length * 7 + init.length);
  const scale = INITS[init]();
  const weights = Array.from({ length: depth }, () => Float64Array.from({ length: WIDTH * WIDTH }, () => r.normal() * scale));
  let a = Float64Array.from({ length: WIDTH }, () => r.normal());
  const outputs: Float64Array[] = [];
  for (const w of weights) {
    const next = new Float64Array(WIDTH);
    for (let i = 0; i < WIDTH; i++) {
      let z = 0;
      for (let j = 0; j < WIDTH; j++) z += w[i * WIDTH + j] * a[j];
      next[i] = ACTS[act].f(z);
    }
    outputs.push(next);
    a = next;
  }
  const norm = (v: Float64Array) => Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length);
  const gradients = new Array<number>(depth);
  let delta = new Float64Array(WIDTH).fill(1);
  for (let l = depth - 1; l >= 0; l--) {
    const local = delta.map((d, i) => d * ACTS[act].d(outputs[l][i]));
    gradients[l] = norm(local);
    const back = new Float64Array(WIDTH);
    for (let j = 0; j < WIDTH; j++) {
      let s = 0;
      for (let i = 0; i < WIDTH; i++) s += weights[l][i * WIDTH + j] * local[i];
      back[j] = s;
    }
    delta = back;
  }
  return gradients;
}

export function GradientFlow() {
  const [depth, setDepth] = useState(12);
  const [act, setAct] = useState<keyof typeof ACTS>("sigmoid");
  const [init, setInit] = useState<keyof typeof INITS>("plain random");
  const gradients = useMemo(() => signalFlow(depth, act, init), [depth, act, init]);
  const first = gradients[0];
  const verdict = !Number.isFinite(first) || first > 1e3 ? "Exploding" : first < 1e-3 ? "Vanishing" : "Healthy";

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0.5, depth + 0.5], [-10, 10], { x: "layer (input side → output side)", y: "gradient size, powers of 10" });
    ctx.strokeStyle = "#333";
    ctx.beginPath();
    ctx.moveTo(p.left, p.py(0));
    ctx.lineTo(p.right, p.py(0));
    ctx.stroke();
    const bar = Math.min(26, ((p.right - p.left) / depth) * 0.6);
    gradients.forEach((g, i) => {
      const level = Math.max(-10, Math.min(10, Math.log10(Math.max(g, 1e-300))));
      ctx.fillStyle = Math.abs(level) > 3 ? NEG : POS;
      const y = p.py(level);
      ctx.fillRect(p.px(i + 1) - bar / 2, Math.min(y, p.py(0)), bar, Math.max(2, Math.abs(y - p.py(0))));
    });
  }, [gradients, depth]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Layers" value={depth} min={2} max={30} step={1} onChange={setDepth} />
          <Choice label="Activation" value={act} options={["sigmoid", "tanh", "relu"] as const} onChange={setAct} />
          <Choice label="Starting weights" value={init} options={["plain random", "Glorot", "He"] as const} onChange={setInit} />
          <Readout label="Gradient reaching layer 1" value={Number.isFinite(first) ? first.toExponential(1) : "overflow"} />
          <Readout label="Verdict" value={verdict} tone={verdict === "Healthy" ? "pos" : "neg"} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Gradient size at each layer of a deep network" />
      <p className="label pointer-events-none absolute right-4 top-3">bar at 0 = gradient of size 1 · green = usable · red = too small or too large</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. optimizers
const loss = (x: number, y: number) => 0.05 * x * x + 1.5 * y * y;
const grad = (x: number, y: number): [number, number] => [0.1 * x, 3 * y];
const OPTIMIZERS = ["SGD", "Momentum", "RMSProp", "Adam"] as const;
const OPT_COLORS = { SGD: "#ffffff", Momentum: POS, RMSProp: BLUE, Adam: NEG };

function descend(kind: (typeof OPTIMIZERS)[number], speed: number) {
  let x = -8, y = 2;
  let vx = 0, vy = 0, sx = 0, sy = 0;
  const path: [number, number][] = [[x, y]];
  for (let t = 1; t <= 150; t++) {
    const [gx, gy] = grad(x, y);
    if (kind === "SGD") {
      x -= 0.55 * speed * gx; y -= 0.55 * speed * gy;
    } else if (kind === "Momentum") {
      vx = 0.9 * vx - 0.08 * speed * gx; vy = 0.9 * vy - 0.08 * speed * gy;
      x += vx; y += vy;
    } else if (kind === "RMSProp") {
      sx = 0.9 * sx + 0.1 * gx * gx; sy = 0.9 * sy + 0.1 * gy * gy;
      x -= (0.25 * speed * gx) / (Math.sqrt(sx) + 1e-8); y -= (0.25 * speed * gy) / (Math.sqrt(sy) + 1e-8);
    } else {
      vx = 0.9 * vx + 0.1 * gx; vy = 0.9 * vy + 0.1 * gy;
      sx = 0.999 * sx + 0.001 * gx * gx; sy = 0.999 * sy + 0.001 * gy * gy;
      const mx = vx / (1 - 0.9 ** t), my = vy / (1 - 0.9 ** t);
      const hx = sx / (1 - 0.999 ** t), hy = sy / (1 - 0.999 ** t);
      x -= (0.45 * speed * mx) / (Math.sqrt(hx) + 1e-8); y -= (0.45 * speed * my) / (Math.sqrt(hy) + 1e-8);
    }
    path.push([x, y]);
  }
  return path;
}

export function Optimizers() {
  const [speed, setSpeed] = useState(1);
  const [run, setRun] = useState(1);
  const [frame, setFrame] = useState(0);
  const paths = useMemo(() => Object.fromEntries(OPTIMIZERS.map((k) => [k, descend(k, speed)])) as Record<(typeof OPTIMIZERS)[number], [number, number][]>, [speed]);

  useEffect(() => {
    let f = 0;
    const timer = setInterval(() => {
      setFrame(f);
      if (f++ >= 150) clearInterval(timer);
    }, 45);
    return () => clearInterval(timer);
  }, [run, speed]);

  const arrival = (kind: (typeof OPTIMIZERS)[number]) => {
    const step = paths[kind].findIndex(([x, y]) => loss(x, y) < 0.02);
    return step < 0 ? "not in 150" : `${step} steps`;
  };

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-9, 3], [-3, 3], { x: "weight 1 (gentle slope)", y: "weight 2 (steep)" });
    dotMap(ctx, p, (x, y) => {
      const level = Math.max(0, 1 - Math.log1p(loss(x, y)) / 2.9);
      return { size: level * 0.55, color: `rgba(255,255,255,${0.1 + level * 0.25})` };
    });
    for (const kind of OPTIMIZERS) {
      const path = paths[kind].slice(0, frame + 1);
      ctx.strokeStyle = OPT_COLORS[kind];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      path.forEach(([x, y], i) => (i ? ctx.lineTo(p.px(x), p.py(Math.max(-3, Math.min(3, y)))) : ctx.moveTo(p.px(x), p.py(y))));
      ctx.stroke();
      const [x, y] = path[path.length - 1];
      square(ctx, p.px(x), p.py(Math.max(-3, Math.min(3, y))), 8, OPT_COLORS[kind]);
    }
    square(ctx, p.px(0), p.py(0), 14, "#fff", true);
  }, [paths, frame]);

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Learning rate (all four)" value={speed} min={0.3} max={1.3} step={0.05} onChange={setSpeed} format={(v) => `×${v.toFixed(2)}`} />
          <button className="btn btn-solid" onClick={() => setRun((r) => r + 1)}>▶ Race again</button>
          {OPTIMIZERS.map((kind) => (
            <div key={kind} className="flex flex-col">
              <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-dim">
                <span className="inline-block h-2.5 w-2.5" style={{ background: OPT_COLORS[kind] }} />
                {kind}
              </span>
              <span className="font-mono text-sm tabular-nums">{arrival(kind)}</span>
            </div>
          ))}
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Four optimizers descending a long narrow valley" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. learning rate schedules
const EPOCHS = 100;
const SCHEDULES = {
  constant: () => 0.5,
  exponential: (t: number) => 0.5 * 0.96 ** t,
  "step drops": (t: number) => 0.5 * 0.5 ** Math.floor(t / 25),
  cosine: (t: number) => 0.25 * (1 + Math.cos((Math.PI * t) / EPOCHS)),
  "1cycle": (t: number) => (t < 30 ? 0.05 + (0.45 * t) / 30 : 0.5 - (0.495 * (t - 30)) / 70),
} as const;

export function Schedules() {
  const [name, setName] = useState<keyof typeof SCHEDULES>("constant");
  const run = useMemo(() => {
    const r = rng(404);
    const out: { rate: number; loss: number }[] = [];
    for (let t = 0, w = 5; t < EPOCHS; t++) {
      const rate = SCHEDULES[name](t);
      w -= rate * (w + r.normal() * 2.2); // true gradient is w; the rest is mini-batch noise
      out.push({ rate, loss: (w * w) / 2 });
    }
    return out;
  }, [name]);
  const settled = run.slice(-15).reduce((s, v) => s + v.loss, 0) / 15;

  const ref = useCanvas((ctx, w, h) => {
    const half = w / 2;
    const a = plot(ctx, half, h, [0, EPOCHS], [0, 0.6], { x: "epoch", y: "learning rate" });
    ctx.strokeStyle = POS;
    ctx.lineWidth = 2;
    ctx.beginPath();
    run.forEach((v, t) => (t ? ctx.lineTo(a.px(t), a.py(v.rate)) : ctx.moveTo(a.px(0), a.py(v.rate))));
    ctx.stroke();
    ctx.save();
    ctx.translate(half, 0);
    const b = plot(ctx, half, h, [0, EPOCHS], [0, 3], { x: "epoch", y: "loss" });
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    run.forEach((v, t) => (t ? ctx.lineTo(b.px(t), b.py(Math.min(3, v.loss))) : ctx.moveTo(b.px(0), b.py(Math.min(3, v.loss)))));
    ctx.stroke();
    ctx.restore();
  }, [run]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Schedule" value={name} options={["constant", "exponential", "step drops", "cosine", "1cycle"] as const} onChange={setName} />
          <Readout label="Loss it settles at" value={settled.toFixed(3)} tone={settled < 0.05 ? "pos" : settled > 0.3 ? "neg" : undefined} />
          <span className="max-w-sm text-sm text-dim">Same noisy problem and same starting point each time. Only the learning rate plan changes.</span>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Learning rate schedule and the loss it produces" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. dropout
const LAYER_SIZES = [5, 8, 8, 3];

export function Dropout() {
  const [percent, setPercent] = useState(40);
  const [phase, setPhase] = useState<"training" | "using the model">("training");
  const [tick, setTick] = useState(1);

  useEffect(() => {
    if (phase !== "training") return;
    const timer = setInterval(() => setTick((t) => t + 1), 900);
    return () => clearInterval(timer);
  }, [phase]);

  const alive = useMemo(() => {
    const r = rng(tick * 613);
    return LAYER_SIZES.map((n, layer) =>
      Array.from({ length: n }, () => {
        const u = r.next();
        const hidden = layer > 0 && layer < LAYER_SIZES.length - 1;
        return !(hidden && phase === "training" && u < percent / 100);
      }),
    );
  }, [tick, percent, phase]);
  const hiddenTotal = LAYER_SIZES.slice(1, -1).reduce((a, b) => a + b, 0);
  const hiddenAlive = alive.slice(1, -1).flat().filter(Boolean).length;

  const ref = useCanvas((ctx, w, h) => {
    const x = (layer: number) => 60 + (layer / (LAYER_SIZES.length - 1)) * (w - 120);
    const y = (layer: number, i: number) => h / 2 + (i - (LAYER_SIZES[layer] - 1) / 2) * Math.min(34, (h - 40) / 8);
    for (let layer = 1; layer < LAYER_SIZES.length; layer++) {
      for (let i = 0; i < LAYER_SIZES[layer]; i++) {
        for (let j = 0; j < LAYER_SIZES[layer - 1]; j++) {
          if (!alive[layer][i] || !alive[layer - 1][j]) continue;
          ctx.strokeStyle = "rgba(255,255,255,0.22)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x(layer - 1), y(layer - 1, j));
          ctx.lineTo(x(layer), y(layer, i));
          ctx.stroke();
        }
      }
    }
    LAYER_SIZES.forEach((n, layer) => {
      for (let i = 0; i < n; i++) {
        square(ctx, x(layer), y(layer, i), 14, "#000");
        square(ctx, x(layer), y(layer, i), 14, alive[layer][i] ? "#fff" : NEG, !alive[layer][i]);
      }
    });
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = DIM;
    ctx.textAlign = "center";
    ["INPUT", "HIDDEN", "HIDDEN", "OUTPUT"].forEach((label, layer) => ctx.fillText(label, x(layer), h - 8));
  }, [alive]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Dropout rate" value={percent} min={0} max={80} step={5} onChange={setPercent} format={(v) => `${v}%`} />
          <Choice label="Phase" value={phase} options={["training", "using the model"] as const} onChange={setPhase} />
          <Readout label="Hidden neurons switched on" value={`${hiddenAlive} / ${hiddenTotal}`} tone={hiddenAlive === hiddenTotal ? "pos" : undefined} />
          <span className="max-w-xs text-sm text-dim">During training a new random set is switched off at every step. Hollow red = off for this step.</span>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="A network with random neurons switched off by dropout" />
    </Frame>
  );
}

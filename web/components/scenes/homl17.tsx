"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Choice, DIM, Frame, NEG, POS, Readout, Slider, curve, line, plot, rng, square, useCanvas } from "./ui";

// ---------------------------------------------------------------- 1. the bottleneck
const PAIRS = (() => {
  const r = rng(23);
  return Array.from({ length: 60 }, () => {
    const a = r.normal() * 1.6, b = r.normal() * 0.35;
    return { x: a * 0.82 - b * 0.57, y: a * 0.57 + b * 0.82 };
  });
})();
const BEST_ANGLE = (() => {
  let best = 0, bestError = Infinity;
  for (let deg = 0; deg < 180; deg++) {
    const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
    const error = PAIRS.reduce((t, p) => t + (p.x * -s + p.y * c) ** 2, 0);
    if (error < bestError) { bestError = error; best = deg; }
  }
  return best;
})();

export function Bottleneck() {
  const [angle, setAngle] = useState(120);
  const [training, setTraining] = useState(false);
  const c = Math.cos((angle * Math.PI) / 180), s = Math.sin((angle * Math.PI) / 180);
  const decoded = PAIRS.map((p) => {
    const code = p.x * c + p.y * s; // the single number that gets through
    return { x: code * c, y: code * s };
  });
  const error = Math.sqrt(PAIRS.reduce((t, p, i) => t + (p.x - decoded[i].x) ** 2 + (p.y - decoded[i].y) ** 2, 0) / PAIRS.length);

  useEffect(() => {
    if (!training) return;
    let current = angle;
    const timer = setInterval(() => {
      const gap = BEST_ANGLE - current;
      current += Math.abs(gap) < 1 ? gap : Math.sign(gap) * Math.max(1, Math.abs(gap) * 0.15);
      setAngle(Math.round(current));
      if (Math.abs(BEST_ANGLE - current) < 0.5) {
        clearInterval(timer);
        setTraining(false);
      }
    }, 60);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training]);

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-5, 5], [-3.2, 3.2]);
    line(ctx, p, -s, c, 0, "#666", [5, 5]);
    PAIRS.forEach((d, i) => {
      ctx.strokeStyle = "rgba(255,92,122,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.px(d.x), p.py(d.y));
      ctx.lineTo(p.px(decoded[i].x), p.py(decoded[i].y));
      ctx.stroke();
      square(ctx, p.px(d.x), p.py(d.y), 5, "#fff");
      square(ctx, p.px(decoded[i].x), p.py(decoded[i].y), 5, POS);
    });
  }, [angle]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Direction the code keeps" value={angle} min={0} max={179} step={1} onChange={setAngle} format={(v) => `${v}°`} />
          <button className="btn btn-solid" onClick={() => setTraining(true)} disabled={training}>▶ Train it</button>
          <Readout label="Numbers in" value="2" />
          <Readout label="Numbers through the bottleneck" value="1" />
          <Readout label="Reconstruction error" value={error.toFixed(3)} tone={error < 0.4 ? "pos" : error > 1 ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Points squeezed to one number and reconstructed" />
      <p className="label pointer-events-none absolute right-4 top-3">white = original · green = rebuilt from 1 number · red = what was lost</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. walking through latent space
const SIZE = 16;
// A hand-built two-number code (roundness, size) standing in for a learned latent space.
const render = (roundness: number, size: number) =>
  Array.from({ length: SIZE * SIZE }, (_, i) => {
    const x = ((i % SIZE) + 0.5) / SIZE * 2 - 1, y = (Math.floor(i / SIZE) + 0.5) / SIZE * 2 - 1;
    const n = 2 + (1 - roundness) * 8;
    return Math.pow(Math.abs(x), n) + Math.pow(Math.abs(y), n) <= Math.pow(size, n) ? 1 : 0;
  });
const SHAPE_A = { roundness: 1, size: 0.45 };
const SHAPE_B = { roundness: 0, size: 0.85 };

function Pixels({ values, label }: { values: number[]; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${SIZE}, 11px)` }} role="img" aria-label={label}>
        {values.map((v, i) => {
          const shade = Math.round(16 + v * 239);
          return <span key={i} style={{ width: 11, height: 11, background: `rgb(${shade},${shade},${shade})` }} />;
        })}
      </div>
      <span className="label">{label}</span>
    </div>
  );
}

export function LatentWalk() {
  const [t, setT] = useState(0.5);
  const a = useMemo(() => render(SHAPE_A.roundness, SHAPE_A.size), []);
  const b = useMemo(() => render(SHAPE_B.roundness, SHAPE_B.size), []);
  const blend = a.map((v, i) => v * (1 - t) + b[i] * t);
  const code = { roundness: SHAPE_A.roundness * (1 - t) + SHAPE_B.roundness * t, size: SHAPE_A.size * (1 - t) + SHAPE_B.size * t };
  const walked = render(code.roundness, code.size);
  const ghost = blend.filter((v) => v > 0.05 && v < 0.95).length;

  return (
    <Frame
      controls={
        <>
          <Slider label="From small circle to large square" value={t} min={0} max={1} step={0.01} onChange={setT} format={(v) => `${Math.round(v * 100)}%`} />
          <Readout label="Code" value={`${code.roundness.toFixed(2)}, ${code.size.toFixed(2)}`} tone="pos" />
          <Readout label="Half-faded pixels when blending" value={String(ghost)} tone={ghost ? "neg" : undefined} />
          <span className="max-w-xs text-sm text-dim">The two-number code here is written by hand to show the idea. An autoencoder learns its own.</span>
        </>
      }
    >
      <div className="flex h-full flex-wrap items-center justify-center gap-x-10 gap-y-3 p-3">
        <Pixels values={blend} label="Blending the pixels" />
        <Pixels values={walked} label="Blending the codes" />
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. a tiny GAN
type Gan = { a: number; b: number; w: number; c: number; step: number };
const REAL_MEAN = 2, REAL_SD = 0.5;
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** One round: the detective learns to tell real from fake, then the forger learns to fool it. */
function ganStep(g: Gan, r: ReturnType<typeof rng>): Gan {
  const n = 64, rate = 0.05;
  let { a, b, w, c } = g;
  const real = Array.from({ length: n }, () => REAL_MEAN + r.normal() * REAL_SD);
  const noise = Array.from({ length: n }, () => r.normal());
  const fake = noise.map((z) => a * z + b);
  let gw = 0, gc = 0;
  for (let i = 0; i < n; i++) {
    const dr = sigmoid(w * real[i] + c), df = sigmoid(w * fake[i] + c);
    gw += -(1 - dr) * real[i] + df * fake[i];
    gc += -(1 - dr) + df;
  }
  w -= (rate * gw) / n;
  c -= (rate * gc) / n;
  let ga = 0, gb = 0;
  for (let i = 0; i < n; i++) {
    const df = sigmoid(w * (a * noise[i] + b) + c);
    ga += -(1 - df) * w * noise[i];
    gb += -(1 - df) * w;
  }
  a -= (rate * ga) / n;
  b -= (rate * gb) / n;
  return { a, b, w, c, step: g.step + 1 };
}
const GAN_START: Gan = { a: 1, b: -2, w: 0.1, c: 0, step: 0 };

export function TinyGan() {
  const [gan, setGan] = useState(GAN_START);
  const [running, setRunning] = useState(false);
  const random = useRef(rng(5));

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setGan((g) => {
        let next = g;
        for (let i = 0; i < 8; i++) next = ganStep(next, random.current);
        return next;
      });
    }, 60);
    return () => clearInterval(timer);
  }, [running]);

  const bell = (mean: number, sd: number) => (x: number) => Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-5, 5], [0, 1], { x: "value", y: "" });
    curve(ctx, p, bell(REAL_MEAN, REAL_SD), "#fff", 2);
    curve(ctx, p, bell(gan.b, Math.max(0.08, Math.abs(gan.a))), POS, 2);
    curve(ctx, p, (x) => sigmoid(gan.w * x + gan.c), NEG, 1.5);
  }, [gan]);

  return (
    <Frame
      controls={
        <>
          <button className="btn btn-solid" onClick={() => setRunning((r) => !r)}>{running ? "■ Pause" : "▶ Train"}</button>
          <button className="btn" onClick={() => { setRunning(false); random.current = rng(5); setGan(GAN_START); }}>Reset</button>
          <Readout label="Rounds" value={String(gan.step)} />
          <Readout label="Real data centre" value={REAL_MEAN.toFixed(2)} />
          <Readout label="Forger's centre" value={gan.b.toFixed(2)} tone={Math.abs(gan.b - REAL_MEAN) < 0.25 ? "pos" : undefined} />
          <span className="max-w-xs text-sm text-dim">The simplest possible GAN: one-number data, a two-weight forger and a two-weight detective.</span>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Real data, generated data and the discriminator's opinion" />
      <p className="label pointer-events-none absolute right-4 top-3">white = real data · green = forger&apos;s output · red = detective&apos;s “this is real” score</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. diffusion: adding noise step by step
const STEPS = 50;
const PICTURE = render(0.35, 0.7);
const NOISE = (() => {
  const r = rng(808);
  return Array.from({ length: SIZE * SIZE }, () => r.normal());
})();
// share of the original picture left after t steps (cosine schedule)
const kept = (t: number) => Math.cos(((t / STEPS + 0.008) / 1.008) * (Math.PI / 2)) ** 2 / Math.cos((0.008 / 1.008) * (Math.PI / 2)) ** 2;

export function Diffusion() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"adding noise" | "removing noise">("adding noise");
  const t = direction === "adding noise" ? step : STEPS - step;
  const share = kept(t);
  const noisy = PICTURE.map((v, i) => Math.min(1, Math.max(0, 0.5 + Math.sqrt(share) * (v - 0.5) + Math.sqrt(1 - share) * NOISE[i] * 0.5)));

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, STEPS], [0, 1], { x: "noise steps applied", y: "share" });
    curve(ctx, p, kept, "#fff", 2);
    curve(ctx, p, (x) => 1 - kept(x), DIM, 1.5);
    square(ctx, p.px(t), p.py(share), 11, POS);
  }, [t]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Direction" value={direction} options={["adding noise", "removing noise"] as const} onChange={(d) => { setDirection(d); setStep(0); }} />
          <Slider label="Step" value={step} min={0} max={STEPS} step={1} onChange={setStep} format={(v) => `${v} / ${STEPS}`} />
          <Readout label="Picture left" value={`${Math.round(share * 100)}%`} tone={share > 0.7 ? "pos" : share < 0.1 ? "neg" : undefined} />
          <Readout label="Noise" value={`${Math.round((1 - share) * 100)}%`} />
          <span className="max-w-xs text-sm text-dim">Removing noise is shown with the true picture known. A real diffusion model has to learn that step.</span>
        </>
      }
    >
      <div className="flex h-full flex-col items-center sm:flex-row">
        <div className="shrink-0 p-4"><Pixels values={noisy} label={`After ${t} noise steps`} /></div>
        <canvas ref={ref} className="min-h-0 min-w-0 flex-1 self-stretch" role="img" aria-label="Share of picture and noise at each step" />
      </div>
    </Frame>
  );
}

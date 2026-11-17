"use client";

import { useEffect, useMemo, useState } from "react";
import { fitPolynomial, rmse } from "./homl4";
import { CLASS_COLORS, Choice, DIM, Frame, POS, Readout, Slider, curve, dotMap, plot, rng, square, useCanvas } from "./ui";

type P2 = { x: number; y: number; label: number };

// ---------------------------------------------------------------- 1. with and without labels
const BLOBS: P2[] = (() => {
  const r = rng(11);
  const centres = [[-1.6, 1.1], [1.7, 1.3], [0.1, -1.5]];
  return centres.flatMap(([cx, cy], label) =>
    Array.from({ length: 22 }, () => ({ x: cx + r.normal() * 0.6, y: cy + r.normal() * 0.6, label })),
  );
})();

const nearest = (x: number, y: number, centres: number[][]) => {
  let best = 0;
  centres.forEach(([cx, cy], i) => {
    if ((x - cx) ** 2 + (y - cy) ** 2 < (x - centres[best][0]) ** 2 + (y - centres[best][1]) ** 2) best = i;
  });
  return best;
};

function kMeans(iterations: number) {
  let centres = [[-2.6, -2.4], [-2.0, -2.6], [2.6, -2.5]]; // a deliberately bad start
  for (let i = 0; i < iterations; i++) {
    centres = centres.map((c, k) => {
      const mine = BLOBS.filter((p) => nearest(p.x, p.y, centres) === k);
      return mine.length ? [mine.reduce((s, p) => s + p.x, 0) / mine.length, mine.reduce((s, p) => s + p.y, 0) / mine.length] : c;
    });
  }
  return centres;
}

const TRUE_CENTRES = [0, 1, 2].map((k) => {
  const mine = BLOBS.filter((p) => p.label === k);
  return [mine.reduce((s, p) => s + p.x, 0) / mine.length, mine.reduce((s, p) => s + p.y, 0) / mine.length];
});

export function Labels() {
  const [mode, setMode] = useState<"with labels" | "without labels">("with labels");
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const centres = useMemo(() => kMeans(step), [step]);

  useEffect(() => {
    if (!running) return;
    let round = 0;
    const timer = setInterval(() => {
      round += 1;
      setStep(round);
      if (round >= 8) {
        clearInterval(timer);
        setRunning(false);
      }
    }, 550);
    return () => clearInterval(timer);
  }, [running]);

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-4, 4], [-3.5, 3.5]);
    const supervised = mode === "with labels";
    const active = supervised ? TRUE_CENTRES : centres;
    if (supervised || step > 0) dotMap(ctx, p, (x, y) => ({ size: 0.12, color: CLASS_COLORS[nearest(x, y, active)] + "66" }));
    for (const d of BLOBS) {
      const color = supervised ? CLASS_COLORS[d.label] : step > 0 ? CLASS_COLORS[nearest(d.x, d.y, centres)] : "#ffffff";
      square(ctx, p.px(d.x), p.py(d.y), 7, color);
    }
    if (!supervised) centres.forEach(([cx, cy], k) => square(ctx, p.px(cx), p.py(cy), 18, CLASS_COLORS[k], true));
  }, [mode, step, centres]);

  return (
    <Frame
      controls={
        <>
          <Choice label="The data comes" value={mode} options={["with labels", "without labels"] as const} onChange={(m) => { setMode(m); setStep(0); setRunning(false); }} />
          {mode === "without labels" && (
            <>
              <button className="btn btn-solid" onClick={() => { setStep(0); setRunning(true); }} disabled={running}>▶ Find groups</button>
              <Readout label="Round" value={String(step)} />
            </>
          )}
          <span className="max-w-sm text-sm text-dim">
            {mode === "with labels"
              ? "Supervised: every point came with its answer, so the model learns the borders between known classes."
              : "Unsupervised: no answers given. The three hollow markers move until each sits in the middle of a group."}
          </span>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Points shown with and without class labels" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. instance vs model
const SERIES = (() => {
  const r = rng(4);
  return Array.from({ length: 26 }, () => {
    const x = r.next() * 10;
    return { x, y: 2 + 0.6 * x + r.normal() * 0.9 };
  });
})();

export function InstanceVsModel() {
  const [mode, setMode] = useState<"nearest neighbours" | "a fitted line">("nearest neighbours");
  const [x, setX] = useState(6.3);
  const [k, setK] = useState(3);
  const model = useMemo(() => fitPolynomial(SERIES, 1, 0), []);
  const neighbours = useMemo(() => [...SERIES].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x)).slice(0, k), [x, k]);
  const prediction = mode === "a fitted line" ? model(x) : neighbours.reduce((s, n) => s + n.y, 0) / k;

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, 10], [0, 10], { x: "x", y: "y" });
    if (mode === "a fitted line") curve(ctx, p, model, DIM, 1.5);
    else {
      ctx.strokeStyle = POS;
      ctx.lineWidth = 1;
      for (const n of neighbours) {
        ctx.beginPath();
        ctx.moveTo(p.px(x), p.py(prediction));
        ctx.lineTo(p.px(n.x), p.py(n.y));
        ctx.stroke();
      }
    }
    for (const d of SERIES) square(ctx, p.px(d.x), p.py(d.y), 6, mode !== "a fitted line" && neighbours.includes(d) ? POS : "#fff");
    ctx.strokeStyle = "#444";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(p.px(x), p.top);
    ctx.lineTo(p.px(x), p.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    square(ctx, p.px(x), p.py(prediction), 14, POS, true);
  }, [mode, x, k, neighbours, prediction]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Predict using" value={mode} options={["nearest neighbours", "a fitted line"] as const} onChange={setMode} />
          <Slider label="New x" value={x} min={0} max={10} step={0.1} onChange={setX} format={(v) => v.toFixed(1)} />
          {mode === "nearest neighbours" && <Slider label="Neighbours k" value={k} min={1} max={9} step={1} onChange={setK} />}
          <Readout label="Predicted y" value={prediction.toFixed(2)} tone="pos" />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Prediction for a new point from neighbours or from a fitted line" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. not enough / biased data
const truth = (x: number) => 1 + 1.3 * x - 0.11 * x * x;
const POPULATION = (() => {
  const r = rng(9);
  return Array.from({ length: 320 }, () => {
    const x = r.next() * 10;
    return { x, y: truth(x) + r.normal() * 0.8 };
  });
})();

export function SampleQuality() {
  const [size, setSize] = useState(6);
  const [seed, setSeed] = useState(1);
  const [kind, setKind] = useState<"random" | "biased">("random");
  const sample = useMemo(() => {
    const r = rng(seed * 131 + size);
    const pool = kind === "biased" ? POPULATION.filter((p) => p.x < 4) : POPULATION;
    return Array.from({ length: size }, () => pool[Math.floor(r.next() * pool.length)]);
  }, [size, seed, kind]);
  const model = useMemo(() => fitPolynomial(sample, 2, 0), [sample]);
  const error = rmse(model, POPULATION);

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, 10], [-2, 8], { x: "x", y: "y" });
    for (const d of POPULATION) square(ctx, p.px(d.x), p.py(d.y), 3, "#3a3a3a");
    curve(ctx, p, truth, DIM, 1.5);
    curve(ctx, p, model, POS);
    for (const d of sample) square(ctx, p.px(d.x), p.py(d.y), 7, "#fff");
  }, [sample, model]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Training examples" value={size} min={4} max={200} step={1} onChange={setSize} />
          <Choice label="Sample is" value={kind} options={["random", "biased"] as const} onChange={setKind} />
          <button className="btn" onClick={() => setSeed((s) => s + 1)}>Draw another sample</button>
          <Readout label="Error on everyone" value={error > 99 ? "huge" : error.toFixed(2)} tone={error < 1 ? "pos" : error > 2 ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="A model trained on a small sample compared with the full population" />
      <p className="label pointer-events-none absolute right-4 top-3">white = what the model saw · grey = truth · green = what it learned</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. hold out a test set
const POOL = POPULATION.slice(0, 60);

function holdout(seed: number, fraction: number) {
  const r = rng(seed * 977);
  const order = POOL.map((p) => ({ p, key: r.next() })).sort((a, b) => a.key - b.key).map((o) => o.p);
  const cut = Math.max(2, Math.round(order.length * fraction));
  const test = order.slice(0, cut);
  const train = order.slice(cut);
  const model = fitPolynomial(train, 2, 0);
  return { train, test, model, trainError: rmse(model, train), testError: rmse(model, test) };
}

export function Holdout() {
  const [percent, setPercent] = useState(20);
  const [seed, setSeed] = useState(1);
  const split = useMemo(() => holdout(seed, percent / 100), [seed, percent]);
  const history = useMemo(
    () => Array.from({ length: Math.min(seed, 14) }, (_, i) => holdout(seed - i, percent / 100).testError).reverse(),
    [seed, percent],
  );
  const spread = history.length > 1 ? Math.max(...history) - Math.min(...history) : 0;

  const ref = useCanvas((ctx, w, h) => {
    const split2 = w * 0.68;
    const p = plot(ctx, split2, h, [0, 10], [-2, 8], { x: "x", y: "y" });
    curve(ctx, p, split.model, DIM, 1.5);
    for (const d of split.train) square(ctx, p.px(d.x), p.py(d.y), 6, "#fff");
    for (const d of split.test) square(ctx, p.px(d.x), p.py(d.y), 9, POS, true);
    ctx.save();
    ctx.translate(split2, 0);
    const q = plot(ctx, w - split2, h, [0, 15], [0, 2], { x: "test score per shuffle" });
    history.forEach((value, i) => square(ctx, q.px(i + 1), q.py(Math.min(2, value)), 7, i === history.length - 1 ? POS : "#fff"));
    ctx.restore();
  }, [split, history]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Held back for testing" value={percent} min={5} max={50} step={5} onChange={setPercent} format={(v) => `${v}%`} />
          <button className="btn btn-solid" onClick={() => setSeed((s) => s + 1)}>Shuffle and split again</button>
          <Readout label="Training error" value={split.trainError.toFixed(2)} />
          <Readout label="Test error" value={split.testError.toFixed(2)} tone="pos" />
          <Readout label="Test score wobble" value={history.length > 1 ? spread.toFixed(2) : "–"} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Train and test split with the test score of each shuffle" />
      <p className="label pointer-events-none absolute left-14 top-3">■ train · □ test</p>
    </Frame>
  );
}

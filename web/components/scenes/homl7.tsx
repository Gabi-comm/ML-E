"use client";

import { useMemo, useState } from "react";
import { grow, predict, type Node, type Pt } from "./homl6";
import { CLASS_COLORS, Choice, DIM, Frame, POS, Readout, Slider, curve, dotMap, plot, rng, square, useCanvas } from "./ui";

// ---------------------------------------------------------------- 1. many weak voters
/** Chance that a majority of n independent voters, each right with probability p, is right. */
function majority(n: number, p: number) {
  let pmf = Math.pow(1 - p, n);
  let total = 0;
  for (let k = 0; k <= n; k++) {
    if (k > n / 2) total += pmf;
    pmf *= ((n - k) / (k + 1)) * (p / (1 - p));
  }
  return total;
}

export function Voting() {
  const [percent, setPercent] = useState(55);
  const [voters, setVoters] = useState(1);
  const p = percent / 100;
  const n = voters * 2 - 1; // always odd, so there is never a tie
  const line = useMemo(() => Array.from({ length: 251 }, (_, i) => majority(i * 2 + 1, p)), [p]);
  const result = majority(n, p);

  const ref = useCanvas((ctx, w, h) => {
    const pl = plot(ctx, w, h, [1, 501], [0.5, 1], { x: "number of voters", y: "majority is right" });
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    line.forEach((v, i) => (i ? ctx.lineTo(pl.px(i * 2 + 1), pl.py(v)) : ctx.moveTo(pl.px(1), pl.py(v))));
    ctx.stroke();
    ctx.strokeStyle = "#444";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pl.left, pl.py(p));
    ctx.lineTo(pl.right, pl.py(p));
    ctx.stroke();
    ctx.setLineDash([]);
    square(ctx, pl.px(n), pl.py(result), 12, POS);
  }, [line, n, result, p]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Each voter is right" value={percent} min={51} max={75} step={1} onChange={setPercent} format={(v) => `${v}%`} />
          <Slider label="Number of voters" value={voters} min={1} max={251} step={1} onChange={setVoters} format={() => String(n)} />
          <Readout label="The majority is right" value={`${(result * 100).toFixed(1)}%`} tone={result > 0.9 ? "pos" : undefined} />
          <span className="max-w-xs text-sm text-dim">Assumes voters make independent mistakes. Real models trained on the same data do not, so the gain is smaller.</span>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Majority vote accuracy as the number of voters grows" />
      <p className="label pointer-events-none absolute right-4 top-3">dashed = one voter alone</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. bagging
function crescents(n: number, seed: number): Pt[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI * r.next();
    const top = i % 2 === 0;
    return {
      x: (top ? Math.cos(a) : 1 - Math.cos(a)) + r.normal() * 0.28 - 0.5,
      y: (top ? Math.sin(a) : 0.5 - Math.sin(a)) + r.normal() * 0.28 - 0.25,
      label: top ? 0 : 1,
    };
  });
}
const BAG_TRAIN = crescents(80, 3);
const BAG_TEST = crescents(300, 99);
const FOREST: Node[] = (() => {
  const r = rng(2024);
  return Array.from({ length: 60 }, () => {
    const sample = Array.from({ length: BAG_TRAIN.length }, () => BAG_TRAIN[Math.floor(r.next() * BAG_TRAIN.length)]);
    return grow(sample, 2, 0, 8, 1);
  });
})();
const SINGLE = grow(BAG_TRAIN, 2, 0, 8, 1);
const share = (trees: Node[], x: number, y: number) => trees.reduce((s, t) => s + predict(t, x, y), 0) / trees.length;
const accuracyOf = (f: (x: number, y: number) => number) => BAG_TEST.filter((p) => f(p.x, p.y) === p.label).length / BAG_TEST.length;
const SINGLE_ACCURACY = accuracyOf((x, y) => predict(SINGLE, x, y));

export function Bagging() {
  const [count, setCount] = useState(1);
  const trees = useMemo(() => FOREST.slice(0, count), [count]);
  const accuracy = useMemo(() => accuracyOf((x, y) => (share(trees, x, y) >= 0.5 ? 1 : 0)), [trees]);

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-2.4, 2.4], [-2, 2], { x: "feature 1", y: "feature 2" });
    dotMap(ctx, p, (x, y) => {
      const s = share(trees, x, y);
      return { size: 0.15 + Math.abs(s - 0.5) * 1.1, color: CLASS_COLORS[s >= 0.5 ? 1 : 0] + "70" };
    });
    for (const d of BAG_TRAIN) square(ctx, p.px(d.x), p.py(d.y), 6, CLASS_COLORS[d.label]);
  }, [trees]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Trees voting" value={count} min={1} max={60} step={1} onChange={setCount} />
          <Readout label="One full tree, new data" value={`${(SINGLE_ACCURACY * 100).toFixed(0)}%`} />
          <Readout label="This forest, new data" value={`${(accuracy * 100).toFixed(0)}%`} tone={accuracy > SINGLE_ACCURACY + 0.01 ? "pos" : undefined} />
          <span className="max-w-xs text-sm text-dim">Each tree trained on a different random resample of the same 80 points. Dot size shows how strongly the trees agree.</span>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Decision regions from a growing number of bagged trees" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. gradient boosting
const target = (x: number) => 3 * x * x - 0.2 + 0.4 * Math.sin(6 * x);
const noisy = (n: number, seed: number) => {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const x = r.next() - 0.5;
    return { x, y: target(x) + r.normal() * 0.09 };
  });
};
const BOOST_TRAIN = noisy(50, 14);
const BOOST_TEST = noisy(200, 141);
type Stump = { threshold: number; left: number; right: number };

/** Best single split (a "stump") for predicting the leftover errors. */
function fitStump(xs: number[], residuals: number[]): Stump {
  const order = xs.map((x, i) => i).sort((a, b) => xs[a] - xs[b]);
  let best: Stump = { threshold: 0, left: 0, right: 0 };
  let bestError = Infinity;
  for (let cut = 1; cut < order.length; cut++) {
    const leftIdx = order.slice(0, cut), rightIdx = order.slice(cut);
    const left = leftIdx.reduce((s, i) => s + residuals[i], 0) / leftIdx.length;
    const right = rightIdx.reduce((s, i) => s + residuals[i], 0) / rightIdx.length;
    const error = leftIdx.reduce((s, i) => s + (residuals[i] - left) ** 2, 0) + rightIdx.reduce((s, i) => s + (residuals[i] - right) ** 2, 0);
    if (error < bestError) {
      bestError = error;
      best = { threshold: (xs[order[cut - 1]] + xs[order[cut]]) / 2, left, right };
    }
  }
  return best;
}

function boost(rate: number, stages: number) {
  const xs = BOOST_TRAIN.map((p) => p.x);
  const base = BOOST_TRAIN.reduce((s, p) => s + p.y, 0) / BOOST_TRAIN.length;
  const current = xs.map(() => base);
  const stumps: Stump[] = [];
  for (let s = 0; s < stages; s++) {
    const stump = fitStump(xs, BOOST_TRAIN.map((p, i) => p.y - current[i]));
    stumps.push(stump);
    xs.forEach((x, i) => (current[i] += rate * (x <= stump.threshold ? stump.left : stump.right)));
  }
  return { base, stumps };
}

export function Boosting() {
  const [stages, setStages] = useState(0);
  const [rateName, setRateName] = useState<"1.0" | "0.3" | "0.1">("0.3");
  const rate = Number(rateName);
  const full = useMemo(() => boost(rate, 80), [rate]);
  const model = (x: number) => full.stumps.slice(0, stages).reduce((s, t) => s + rate * (x <= t.threshold ? t.left : t.right), full.base);
  const error = (points: { x: number; y: number }[]) => Math.sqrt(points.reduce((s, p) => s + (model(p.x) - p.y) ** 2, 0) / points.length);
  const trainError = error(BOOST_TRAIN);
  const testError = error(BOOST_TEST);

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-0.5, 0.5], [-0.8, 1], { x: "x", y: "y" });
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    for (const d of BOOST_TRAIN) {
      ctx.beginPath();
      ctx.moveTo(p.px(d.x), p.py(d.y));
      ctx.lineTo(p.px(d.x), p.py(model(d.x)));
      ctx.stroke();
      square(ctx, p.px(d.x), p.py(d.y), 5, "#fff");
    }
    curve(ctx, p, target, DIM, 1);
    curve(ctx, p, model, POS);
  }, [stages, rate, full]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Small trees added" value={stages} min={0} max={80} step={1} onChange={setStages} />
          <Choice label="Learning rate" value={rateName} options={["1.0", "0.3", "0.1"] as const} onChange={setRateName} />
          <Readout label="Training error" value={trainError.toFixed(3)} />
          <Readout label="New-data error" value={testError.toFixed(3)} tone={testError < 0.115 ? "pos" : testError > trainError * 2.2 ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Gradient boosting prediction after a number of stages" />
      <p className="label pointer-events-none absolute right-4 top-3">green = ensemble so far · grey lines = errors the next tree will fix</p>
    </Frame>
  );
}

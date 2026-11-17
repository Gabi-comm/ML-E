"use client";

import { useMemo, useState } from "react";
import { Choice, DIM, Frame, LINE, NEG, POS, Readout, Slider, plot, rng, square, useCanvas } from "./ui";

// Scores a classifier gave to 100 images: 40 really are the digit, 60 are not.
const SCORED = (() => {
  const r = rng(17);
  const clamp = (v: number) => Math.min(0.99, Math.max(0.01, v));
  return [
    ...Array.from({ length: 40 }, () => ({ score: clamp(0.66 + r.normal() * 0.15), positive: true })),
    ...Array.from({ length: 60 }, () => ({ score: clamp(0.36 + r.normal() * 0.15), positive: false })),
  ];
})();

function counts(threshold: number) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const s of SCORED) {
    const flagged = s.score >= threshold;
    if (flagged && s.positive) tp++;
    else if (flagged) fp++;
    else if (s.positive) fn++;
    else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp / (tp + fn);
  return { tp, fp, fn, tn, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0, fpr: fp / (fp + tn) };
}

const SWEEP = Array.from({ length: 101 }, (_, i) => counts(i / 100));

function drawScores(ctx: CanvasRenderingContext2D, w: number, h: number, threshold: number) {
  const p = plot(ctx, w, h, [0, 1], [-1, 1], { x: "score the model gave" });
  const mid = p.py(0);
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(p.left, mid);
  ctx.lineTo(p.right, mid);
  ctx.stroke();
  const stacks = new Map<string, number>();
  for (const s of SCORED) {
    const bin = Math.floor(s.score / 0.025);
    const key = `${bin}-${s.positive}`;
    const level = stacks.get(key) ?? 0;
    stacks.set(key, level + 1);
    const x = p.px((bin + 0.5) * 0.025);
    const y = s.positive ? mid - 10 - level * 10 : mid + 10 + level * 10;
    const flagged = s.score >= threshold;
    const right = flagged === s.positive;
    square(ctx, x, y, 7, s.positive ? POS : NEG, !right);
  }
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.px(threshold), p.top);
  ctx.lineTo(p.px(threshold), p.bottom);
  ctx.stroke();
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.fillText("says YES ▸", Math.min(p.px(threshold) + 6, p.right - 70), p.top + 6);
  ctx.textAlign = "right";
  ctx.fillStyle = DIM;
  ctx.fillText("◂ says NO", Math.max(p.px(threshold) - 6, p.left + 64), p.top + 6);
}

// ---------------------------------------------------------------- 1. confusion matrix
export function Threshold() {
  const [threshold, setThreshold] = useState(0.5);
  const c = counts(threshold);
  const ref = useCanvas((ctx, w, h) => drawScores(ctx, w, h, threshold), [threshold]);
  const cell = (label: string, value: number, good: boolean) => (
    <div className={`flex flex-col justify-center border p-2 ${good ? "border-pos/60" : "border-neg/60"}`}>
      <span className="font-mono text-2xl tabular-nums">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-dim">{label}</span>
    </div>
  );

  return (
    <Frame
      controls={
        <>
          <Slider label="Decision threshold" value={threshold} min={0.05} max={0.95} step={0.01} onChange={setThreshold} format={(v) => v.toFixed(2)} />
          <Readout label="Precision" value={`${(c.precision * 100).toFixed(0)}%`} />
          <Readout label="Recall" value={`${(c.recall * 100).toFixed(0)}%`} />
          <Readout label="F1" value={c.f1.toFixed(2)} tone={c.f1 > 0.8 ? "pos" : undefined} />
        </>
      }
    >
      <div className="flex h-full flex-col sm:flex-row">
        <canvas ref={ref} className="min-h-0 min-w-0 flex-1" role="img" aria-label="Scores of positive and negative examples with a movable threshold" />
        <div className="grid shrink-0 grid-cols-2 gap-1 p-3 sm:w-60 sm:content-center">
          {cell("Caught (true positive)", c.tp, true)}
          {cell("Missed (false negative)", c.fn, false)}
          {cell("False alarm (false positive)", c.fp, false)}
          {cell("Correctly ignored (true negative)", c.tn, true)}
        </div>
      </div>
      <p className="label pointer-events-none absolute bottom-8 left-12">green above = really the digit · red below = not · hollow = model got it wrong</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. PR and ROC curves
export function Curves() {
  const [threshold, setThreshold] = useState(0.5);
  const c = counts(threshold);
  const auc = useMemo(() => {
    const pts = SWEEP.map((s) => [s.fpr, s.recall]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let area = 0;
    for (let i = 1; i < pts.length; i++) area += ((pts[i][0] - pts[i - 1][0]) * (pts[i][1] + pts[i - 1][1])) / 2;
    return area;
  }, []);

  const ref = useCanvas((ctx, w, h) => {
    const half = w / 2;
    const draw = (xLabel: string, yLabel: string, xy: (s: (typeof SWEEP)[number]) => [number, number], diagonal: boolean) => {
      const p = plot(ctx, half, h, [0, 1], [0, 1], { x: xLabel, y: yLabel });
      if (diagonal) {
        ctx.strokeStyle = "#333";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(p.px(0), p.py(0));
        ctx.lineTo(p.px(1), p.py(1));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      SWEEP.forEach((s, i) => {
        const [x, y] = xy(s);
        if (i) ctx.lineTo(p.px(x), p.py(y));
        else ctx.moveTo(p.px(x), p.py(y));
      });
      ctx.stroke();
      const [x, y] = xy(c);
      square(ctx, p.px(x), p.py(y), 12, POS);
    };
    draw("recall", "precision", (s) => [s.recall, s.precision], false);
    ctx.save();
    ctx.translate(half, 0);
    draw("false alarm rate", "recall", (s) => [s.fpr, s.recall], true);
    ctx.restore();
  }, [threshold]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Decision threshold" value={threshold} min={0.05} max={0.95} step={0.01} onChange={setThreshold} format={(v) => v.toFixed(2)} />
          <Readout label="Precision" value={`${(c.precision * 100).toFixed(0)}%`} />
          <Readout label="Recall" value={`${(c.recall * 100).toFixed(0)}%`} />
          <Readout label="False alarm rate" value={`${(c.fpr * 100).toFixed(0)}%`} />
          <Readout label="Area under ROC" value={auc.toFixed(3)} tone="pos" />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Precision-recall curve and ROC curve with the current threshold marked" />
      <p className="label pointer-events-none absolute left-14 top-3">Precision vs recall</p>
      <p className="label pointer-events-none absolute left-[calc(50%+3.5rem)] top-3">ROC curve · dashed = random guessing</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. multiclass confusion
// Illustrative counts for a digit classifier: not measured from a real model.
const MATRIX = (() => {
  const r = rng(29);
  const m: number[][] = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => (r.next() < 0.25 ? 1 : 0)));
  const mixups: [number, number, number][] = [[3, 5, 7], [5, 3, 8], [4, 9, 7], [9, 4, 6], [7, 9, 6], [8, 3, 5], [2, 7, 3], [8, 5, 4], [5, 8, 4], [7, 2, 3], [9, 7, 4], [1, 7, 2]];
  for (const [truth, guess, n] of mixups) m[truth][guess] = n;
  for (let d = 0; d < 10; d++) m[d][d] = 100 - m[d].reduce((s, v, i) => (i === d ? s : s + v), 0);
  return m;
})();

export function Confusion() {
  const [view, setView] = useState<"everything" | "errors only">("everything");
  const [picked, setPicked] = useState<[number, number]>([5, 3]);
  const errorsOnly = view === "errors only";
  const peak = errorsOnly ? Math.max(...MATRIX.flatMap((row, i) => row.filter((_, j) => i !== j))) : 100;
  const [truth, guess] = picked;
  const value = MATRIX[truth][guess];

  return (
    <Frame
      tall
      controls={
        <>
          <Choice label="Show" value={view} options={["everything", "errors only"] as const} onChange={setView} />
          <p className="max-w-lg text-white/85" aria-live="polite">
            <span className="font-mono text-pos">{value}</span> of 100 images of a real <b>{truth}</b> were read as <b>{guess}</b>
            {truth === guess ? " (correct)." : value >= 4 ? ": a common mix-up." : "."}
          </p>
          <span className="text-sm text-dim">Illustrative numbers, not measured from a real model.</span>
        </>
      }
    >
      <div className="mx-auto flex h-full max-w-md flex-col justify-center p-3">
        <p className="label mb-1 pl-7 text-center">what the model said ▸</p>
        <div className="grid grid-cols-[1.5rem_repeat(10,1fr)] gap-px">
          <span />
          {MATRIX.map((_, j) => <span key={j} className="text-center font-mono text-[11px] text-dim">{j}</span>)}
          {MATRIX.map((row, i) => (
            <div key={i} className="contents">
              <span className="self-center font-mono text-[11px] text-dim">{i}</span>
              {row.map((count, j) => {
                const shown = errorsOnly && i === j ? 0 : count;
                const size = shown === 0 ? 0 : 18 + 82 * Math.sqrt(shown / peak);
                const selected = truth === i && guess === j;
                return (
                  <button
                    key={j}
                    onMouseEnter={() => setPicked([i, j])}
                    onFocus={() => setPicked([i, j])}
                    onClick={() => setPicked([i, j])}
                    aria-label={`True ${i}, predicted ${j}: ${count}`}
                    className={`grid aspect-square place-items-center border ${selected ? "border-white" : "border-line"}`}
                  >
                    <span style={{ width: `${size}%`, height: `${size}%`, background: i === j ? "#fff" : NEG }} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="label mt-1">▴ the real digit · white = right · red = wrong</p>
      </div>
    </Frame>
  );
}

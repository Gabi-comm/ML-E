"use client";

import { useMemo, useState } from "react";
import { BLUE, Choice, DIM, Frame, NEG, POS, Readout, Slider, curve, plot, rng, square, useCanvas } from "./ui";

// ---------------------------------------------------------------- 1. tensors and shapes
export function TensorShapes() {
  const [rank, setRank] = useState<"0" | "1" | "2" | "3">("2");
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(4);
  const [depth, setDepth] = useState(3);
  const r = Number(rank);
  const shape = r === 0 ? [] : r === 1 ? [cols] : r === 2 ? [rows, cols] : [depth, rows, cols];
  const count = shape.reduce((a, b) => a * b, 1);
  const names = ["scalar (one number)", "vector (a list)", "matrix (a table)", "3D tensor (a stack of tables)"];
  const slices = r === 3 ? depth : 1;
  const gridRows = r >= 2 ? rows : 1;
  const gridCols = r >= 1 ? cols : 1;

  return (
    <Frame
      controls={
        <>
          <Choice label="Number of axes (rank)" value={rank} options={["0", "1", "2", "3"] as const} onChange={setRank} />
          {r >= 1 && <Slider label="Columns" value={cols} min={1} max={8} step={1} onChange={setCols} />}
          {r >= 2 && <Slider label="Rows" value={rows} min={1} max={6} step={1} onChange={setRows} />}
          {r >= 3 && <Slider label="Depth" value={depth} min={1} max={5} step={1} onChange={setDepth} />}
          <Readout label="Shape" value={`(${shape.join(", ")}${shape.length === 1 ? "," : ""})`} tone="pos" />
          <Readout label="Numbers inside" value={String(count)} />
        </>
      }
    >
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="relative" style={{ width: gridCols * 30 + slices * 14, height: gridRows * 30 + slices * 14 }}>
          {Array.from({ length: slices }, (_, s) => (
            <div
              key={s}
              className="absolute grid gap-px bg-black"
              style={{ gridTemplateColumns: `repeat(${gridCols}, 28px)`, left: (slices - 1 - s) * 14, top: (slices - 1 - s) * 14, opacity: s === slices - 1 ? 1 : 0.45 }}
            >
              {Array.from({ length: gridRows * gridCols }, (_, i) => (
                <span key={i} className="grid h-7 w-7 place-items-center border border-white/70 bg-black font-mono text-[10px] text-dim">
                  {((i * 7 + s * 3) % 9) + 1}
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="label">{names[r]}</p>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. a custom loss
const OUTLIER_DATA = (() => {
  const r = rng(77);
  const points = Array.from({ length: 22 }, () => {
    const x = r.next() * 8;
    return { x, y: 1 + 0.8 * x + r.normal() * 0.5 };
  });
  points.push({ x: 1.2, y: 9.5 }, { x: 0.6, y: 8.8 });
  return points;
})();
const huber = (e: number, delta: number) => (Math.abs(e) <= delta ? 0.5 * e * e : delta * (Math.abs(e) - 0.5 * delta));

/** Fit a line by gradient descent using the derivative of the chosen loss. */
function fitLine(derivative: (error: number) => number) {
  let a = 0, b = 0;
  for (let i = 0; i < 4000; i++) {
    let ga = 0, gb = 0;
    for (const p of OUTLIER_DATA) {
      const d = derivative(a + b * p.x - p.y);
      ga += d;
      gb += d * p.x;
    }
    a -= (0.01 * ga) / OUTLIER_DATA.length;
    b -= (0.01 * gb) / OUTLIER_DATA.length;
  }
  return { a, b };
}

export function CustomLoss() {
  const [delta, setDelta] = useState(1);
  const squared = useMemo(() => fitLine((e) => e), []);
  const robust = useMemo(() => fitLine((e) => Math.max(-delta, Math.min(delta, e))), [delta]);

  const ref = useCanvas((ctx, w, h) => {
    const half = w * 0.42;
    const a = plot(ctx, half, h, [-4, 4], [0, 8], { x: "size of the error", y: "penalty" });
    curve(ctx, a, (e) => 0.5 * e * e, DIM, 1.5);
    curve(ctx, a, (e) => huber(e, delta), POS, 2);
    ctx.save();
    ctx.translate(half, 0);
    const b = plot(ctx, w - half, h, [0, 8], [0, 10], { x: "x", y: "y" });
    for (const p of OUTLIER_DATA) square(ctx, b.px(p.x), b.py(p.y), 6, p.y > 8.5 ? NEG : "#fff");
    curve(ctx, b, (x) => squared.a + squared.b * x, DIM, 1.5);
    curve(ctx, b, (x) => robust.a + robust.b * x, POS, 2);
    ctx.restore();
  }, [delta, robust, squared]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Huber threshold δ" value={delta} min={0.2} max={4} step={0.1} onChange={setDelta} format={(v) => v.toFixed(1)} />
          <Readout label="Slope with squared error" value={squared.b.toFixed(2)} tone="neg" />
          <Readout label="Slope with Huber loss" value={robust.b.toFixed(2)} tone="pos" />
          <Readout label="True slope" value="0.80" />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Squared error and Huber loss, and the lines each one fits" />
      <p className="label pointer-events-none absolute right-4 top-3">grey = squared error · green = Huber · red points = outliers</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. automatic differentiation
export function Autodiff() {
  const [w1, setW1] = useState(5);
  const [w2, setW2] = useState(3);
  const [phase, setPhase] = useState<"forward: compute values" | "backward: compute gradients">("forward: compute values");
  const backward = phase.startsWith("backward");
  // f = 3·w1² + 2·w1·w2, broken into single operations
  const sq = w1 * w1, t1 = 3 * sq, prod = w1 * w2, t2 = 2 * prod, f = t1 + t2;
  const nodes = [
    { id: "w1", label: "w₁", value: w1, grad: 6 * w1 + 2 * w2, x: 0.08, y: 0.3 },
    { id: "w2", label: "w₂", value: w2, grad: 2 * w1, x: 0.08, y: 0.75 },
    { id: "sq", label: "w₁²", value: sq, grad: 3, x: 0.34, y: 0.2 },
    { id: "prod", label: "w₁ × w₂", value: prod, grad: 2, x: 0.34, y: 0.7 },
    { id: "t1", label: "× 3", value: t1, grad: 1, x: 0.6, y: 0.2 },
    { id: "t2", label: "× 2", value: t2, grad: 1, x: 0.6, y: 0.7 },
    { id: "f", label: "add → f", value: f, grad: 1, x: 0.88, y: 0.45 },
  ];
  const edges = [["w1", "sq"], ["w1", "prod"], ["w2", "prod"], ["sq", "t1"], ["prod", "t2"], ["t1", "f"], ["t2", "f"]];

  const ref = useCanvas((ctx, w, h) => {
    const at = (id: string) => {
      const n = nodes.find((node) => node.id === id)!;
      return [n.x * w, n.y * (h - 20) + 10] as const;
    };
    ctx.lineWidth = 1.5;
    for (const [from, to] of edges) {
      const [x1, y1] = at(from), [x2, y2] = at(to);
      ctx.strokeStyle = backward ? NEG : "#777";
      ctx.beginPath();
      ctx.moveTo(x1 + 44, y1);
      ctx.lineTo(x2 - 44, y2);
      ctx.stroke();
      const tip = backward ? [x1 + 44, y1] : [x2 - 44, y2];
      square(ctx, tip[0], tip[1], 6, backward ? NEG : "#fff");
    }
    ctx.textAlign = "center";
    for (const n of nodes) {
      const [x, y] = at(n.id);
      ctx.fillStyle = "#000";
      ctx.fillRect(x - 44, y - 24, 88, 48);
      ctx.strokeStyle = n.id === "f" ? POS : "#fff";
      ctx.strokeRect(x - 44, y - 24, 88, 48);
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillStyle = DIM;
      ctx.fillText(n.label, x, y - 8);
      ctx.font = "13px ui-monospace, monospace";
      ctx.fillStyle = backward ? NEG : "#fff";
      ctx.fillText(backward ? `∂f = ${Number(n.grad.toFixed(2))}` : String(Number(n.value.toFixed(2))), x, y + 12);
    }
  }, [w1, w2, backward]);

  return (
    <Frame
      controls={
        <>
          <Slider label="w₁" value={w1} min={-6} max={6} step={0.5} onChange={setW1} />
          <Slider label="w₂" value={w2} min={-6} max={6} step={0.5} onChange={setW2} />
          <Choice label="Pass" value={phase} options={["forward: compute values", "backward: compute gradients"] as const} onChange={setPhase} />
          <Readout label="f = 3w₁² + 2w₁w₂" value={String(f)} />
          <Readout label="∂f/∂w₁" value={String(6 * w1 + 2 * w2)} tone="pos" />
          <Readout label="∂f/∂w₂" value={String(2 * w1)} tone="pos" />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Computation graph with forward values and backward gradients" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. the training loop, one stage at a time
const LOOP_DATA = (() => {
  const r = rng(31);
  return Array.from({ length: 40 }, () => {
    const x = r.next() * 4 - 2;
    return { x, y: 2 * x + 1 + r.normal() * 0.3 };
  });
})();
const STAGES = ["Take a batch", "Predict (forward pass)", "Measure the loss", "Compute gradients", "Update the weights"] as const;

function runLoop(ticks: number) {
  let w = 0, b = 0;
  const history: number[] = [];
  let view = { batch: [] as typeof LOOP_DATA, predictions: [] as number[], loss: 0, gw: 0, gb: 0, w, b, nw: w, nb: b };
  const steps = Math.floor(ticks / 5) + 1;
  for (let step = 0; step < steps; step++) {
    const batch = Array.from({ length: 4 }, (_, i) => LOOP_DATA[(step * 4 + i) % LOOP_DATA.length]);
    const predictions = batch.map((p) => w * p.x + b);
    const errors = predictions.map((v, i) => v - batch[i].y);
    const loss = errors.reduce((s, e) => s + e * e, 0) / 4;
    const gw = (2 * errors.reduce((s, e, i) => s + e * batch[i].x, 0)) / 4;
    const gb = (2 * errors.reduce((s, e) => s + e, 0)) / 4;
    view = { batch, predictions, loss, gw, gb, w, b, nw: w - 0.1 * gw, nb: b - 0.1 * gb };
    if (step < steps - 1) {
      history.push(loss);
      w = view.nw;
      b = view.nb;
    }
  }
  return { view, history, step: steps };
}

export function TrainingLoop() {
  const [ticks, setTicks] = useState(0);
  const stage = ticks % 5;
  const { view, history, step } = useMemo(() => runLoop(ticks), [ticks]);
  const row = (label: string, value: string, from: number) => (
    <div className={`flex justify-between gap-4 border-b border-line py-1.5 ${stage >= from ? "" : "opacity-20"}`}>
      <span className="text-sm text-white/80">{label}</span>
      <span className="font-mono text-sm tabular-nums">{stage >= from ? value : "…"}</span>
    </div>
  );

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, Math.max(20, history.length)], [0, 6], { x: "training step", y: "loss" });
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    history.forEach((v, i) => (i ? ctx.lineTo(p.px(i + 1), p.py(Math.min(6, v))) : ctx.moveTo(p.px(1), p.py(Math.min(6, v)))));
    ctx.stroke();
    history.forEach((v, i) => square(ctx, p.px(i + 1), p.py(Math.min(6, v)), 4, BLUE));
  }, [history]);

  return (
    <Frame
      tall
      controls={
        <>
          <button className="btn btn-solid" onClick={() => setTicks((t) => t + 1)}>Next stage ▸</button>
          <button className="btn" onClick={() => setTicks((t) => (Math.floor(t / 5) + 1) * 5)}>Finish this step</button>
          <button className="btn" onClick={() => setTicks((t) => (Math.floor(t / 5) + 10) * 5)}>Run 10 steps</button>
          <button className="btn btn-quiet" onClick={() => setTicks(0)}>Reset</button>
          <Readout label="Training step" value={String(step)} />
          <Readout label="Target" value="w = 2, b = 1" />
        </>
      }
    >
      <div className="grid h-full gap-4 p-4 md:grid-cols-[1fr_1fr]">
        <div className="flex flex-col">
          <ol className="mb-3 flex flex-wrap gap-1">
            {STAGES.map((name, i) => (
              <li key={name} className={`border px-2 py-1 font-mono text-[11px] uppercase tracking-wider ${i === stage ? "border-white bg-white text-black" : i < stage ? "border-white/50" : "border-line text-dim"}`}>
                {i + 1}. {name}
              </li>
            ))}
          </ol>
          {row("Batch (x → y)", view.batch.map((p) => `${p.x.toFixed(1)}→${p.y.toFixed(1)}`).join("  "), 0)}
          {row("Current weights", `w = ${view.w.toFixed(3)}, b = ${view.b.toFixed(3)}`, 0)}
          {row("Predictions", view.predictions.map((v) => v.toFixed(1)).join("  "), 1)}
          {row("Loss (mean squared error)", view.loss.toFixed(3), 2)}
          {row("Gradients", `∂w = ${view.gw.toFixed(3)}, ∂b = ${view.gb.toFixed(3)}`, 3)}
          {row("New weights", `w = ${view.nw.toFixed(3)}, b = ${view.nb.toFixed(3)}`, 4)}
        </div>
        <canvas ref={ref} className="h-full min-h-40 w-full" role="img" aria-label="Loss after each training step" />
      </div>
    </Frame>
  );
}

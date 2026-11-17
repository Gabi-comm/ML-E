"use client";

import { useMemo, useState } from "react";
import { Choice, DIM, Frame, NEG, POS, Readout, Slider, plot, rng, square, useCanvas } from "./ui";

// ---------------------------------------------------------------- 1. unrolling through time
const STEPS = 14;
const INPUTS = {
  "one pulse": (t: number) => (t === 0 ? 1 : 0),
  "two pulses": (t: number) => (t === 0 || t === 7 ? 1 : 0),
  steady: () => 0.4,
} as const;

export function Unroll() {
  const [pattern, setPattern] = useState<keyof typeof INPUTS>("one pulse");
  const [wh, setWh] = useState(0.8);
  const [wx, setWx] = useState(1);
  const states = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t < STEPS; t++) out.push(Math.tanh(wx * INPUTS[pattern](t) + wh * (t ? out[t - 1] : 0)));
    return out;
  }, [pattern, wh, wx]);
  const memory = Math.abs(states[10]);

  const ref = useCanvas((ctx, w, h) => {
    const x = (t: number) => 50 + (t / (STEPS - 1)) * (w - 100);
    const yIn = h * 0.22, yState = h * 0.6;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (let t = 0; t < STEPS; t++) {
      const input = INPUTS[pattern](t);
      // input feeding in from above
      ctx.strokeStyle = input ? "#888" : "#262626";
      ctx.beginPath();
      ctx.moveTo(x(t), yIn + 12);
      ctx.lineTo(x(t), yState - 20);
      ctx.stroke();
      square(ctx, x(t), yIn, 6 + input * 14, input ? "#fff" : "#333");
      // memory handed to the next step
      if (t < STEPS - 1) {
        const strength = Math.min(1, Math.abs(states[t] * wh));
        ctx.strokeStyle = `rgba(124,255,178,${0.12 + strength * 0.88})`;
        ctx.lineWidth = 1 + strength * 2;
        ctx.beginPath();
        ctx.moveTo(x(t) + 16, yState);
        ctx.lineTo(x(t + 1) - 16, yState);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      square(ctx, x(t), yState, 30, "#fff", true);
      square(ctx, x(t), yState, 4 + Math.abs(states[t]) * 22, states[t] >= 0 ? POS : NEG);
      ctx.fillStyle = DIM;
      ctx.fillText(states[t].toFixed(2), x(t), yState + 34);
      ctx.fillText(`t=${t}`, x(t), h - 10);
    }
    ctx.textAlign = "left";
    ctx.fillText("INPUT", 8, yIn - 18);
    ctx.fillText("MEMORY (hidden state)", 8, yState - 26);
  }, [states, pattern, wh]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Input over time" value={pattern} options={["one pulse", "two pulses", "steady"] as const} onChange={setPattern} />
          <Slider label="Memory weight" value={wh} min={-1.2} max={1.5} step={0.05} onChange={setWh} format={(v) => v.toFixed(2)} />
          <Slider label="Input weight" value={wx} min={0} max={1.5} step={0.05} onChange={setWx} format={(v) => v.toFixed(2)} />
          <Readout label="Memory left at t = 10" value={memory.toFixed(3)} tone={memory > 0.3 ? "pos" : memory < 0.02 ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="One recurrent neuron unrolled across fourteen time steps" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. forecasting
const SERIES = (() => {
  const r = rng(12);
  return Array.from({ length: 96 }, (_, t) => 10 + 0.05 * t + 3 * Math.sin((2 * Math.PI * t) / 12) + r.normal() * 0.6);
})();
const TRAIN_END = 72;
const LAGS = 12;

/** Autoregressive model: predict the next value from the last 12, fitted by least squares. */
const AR = (() => {
  const n = LAGS + 1;
  const A = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  for (let t = LAGS; t < TRAIN_END; t++) {
    const row = [1, ...Array.from({ length: LAGS }, (_, i) => SERIES[t - 1 - i])];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] += row[i] * row[j];
      A[i][n] += row[i] * SERIES[t];
    }
  }
  for (let i = 0; i < n; i++) A[i][i] += 1e-6;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = A[row][col] / A[col][col];
      for (let c = col; c <= n; c++) A[row][c] -= f * A[col][c];
    }
  }
  return A.map((row, i) => row[n] / row[i]);
})();

function forecast(method: string, horizon: number) {
  const known = SERIES.slice(0, TRAIN_END);
  const out: number[] = [];
  for (let step = 0; step < horizon; step++) {
    const all = [...known, ...out];
    if (method === "repeat last value") out.push(known[known.length - 1]);
    else if (method === "repeat last season") out.push(all[all.length - 12]);
    else out.push(AR.slice(1).reduce((s, w, i) => s + w * all[all.length - 1 - i], AR[0]));
  }
  return out;
}

export function Forecast() {
  const [method, setMethod] = useState<"repeat last value" | "repeat last season" | "learned from 12 lags">("repeat last value");
  const [horizon, setHorizon] = useState(12);
  const predicted = useMemo(() => forecast(method, horizon), [method, horizon]);
  const error = predicted.reduce((s, v, i) => s + Math.abs(v - SERIES[TRAIN_END + i]), 0) / predicted.length;

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [36, 96], [4, 20], { x: "time (months)", y: "value" });
    const path = (values: number[], start: number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      values.forEach((v, i) => (i ? ctx.lineTo(p.px(start + i), p.py(v)) : ctx.moveTo(p.px(start), p.py(v))));
      ctx.stroke();
    };
    path(SERIES.slice(36, TRAIN_END), 36, "#fff", 2);
    path(SERIES.slice(TRAIN_END - 1), TRAIN_END - 1, "#555", 1.5);
    path([SERIES[TRAIN_END - 1], ...predicted], TRAIN_END - 1, POS, 2);
    predicted.forEach((v, i) => square(ctx, p.px(TRAIN_END + i), p.py(v), 5, POS));
    ctx.strokeStyle = "#444";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.px(TRAIN_END - 1), p.top);
    ctx.lineTo(p.px(TRAIN_END - 1), p.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [predicted]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Forecast by" value={method} options={["repeat last value", "repeat last season", "learned from 12 lags"] as const} onChange={setMethod} />
          <Slider label="Months ahead" value={horizon} min={1} max={24} step={1} onChange={setHorizon} />
          <Readout label="Average miss" value={error.toFixed(2)} tone={error < 0.9 ? "pos" : error > 2 ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="A seasonal time series with a forecast" />
      <p className="label pointer-events-none absolute right-4 top-3">white = known past · grey = what really happened · green = forecast</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. forgetting over long sequences
export function LongMemory() {
  const [cell, setCell] = useState<"simple RNN" | "LSTM">("simple RNN");
  const [factor, setFactor] = useState(0.8);
  const [gate, setGate] = useState(0.98);
  const base = cell === "simple RNN" ? factor : gate;
  const at50 = Math.pow(base, 50);

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, 50], [0, 2], { x: "steps back in time", y: "how much signal survives" });
    ctx.strokeStyle = "#333";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.left, p.py(1));
    ctx.lineTo(p.right, p.py(1));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let t = 0; t <= 50; t++) {
      const v = Math.min(2.05, Math.pow(base, t));
      if (t) ctx.lineTo(p.px(t), p.py(v));
      else ctx.moveTo(p.px(0), p.py(v));
    }
    ctx.stroke();
    for (let t = 0; t <= 50; t += 5) square(ctx, p.px(t), p.py(Math.min(2, Math.pow(base, t))), 7, Math.pow(base, t) > 2 || Math.pow(base, t) < 0.01 ? NEG : POS);
  }, [base]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Cell type" value={cell} options={["simple RNN", "LSTM"] as const} onChange={setCell} />
          {cell === "simple RNN" ? (
            <Slider label="Multiplied by, each step" value={factor} min={0.5} max={1.3} step={0.01} onChange={setFactor} format={(v) => v.toFixed(2)} />
          ) : (
            <Slider label="Forget gate (share kept each step)" value={gate} min={0.9} max={1} step={0.005} onChange={setGate} format={(v) => v.toFixed(3)} />
          )}
          <Readout
            label="Left after 50 steps"
            value={at50 > 1000 ? at50.toExponential(1) : at50 < 0.001 ? at50.toExponential(1) : at50.toFixed(3)}
            tone={at50 > 10 || at50 < 0.01 ? "neg" : "pos"}
          />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Signal surviving as it is passed back through time steps" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. inside an LSTM cell
function Bar({ label, value, range = 1, note }: { label: string; value: number; range?: number; note?: string }) {
  const share = Math.min(1, Math.abs(value) / range) * 50;
  return (
    <div className="grid grid-cols-[minmax(9rem,14rem)_1fr_3.5rem] items-center gap-3">
      <span className="text-sm text-white/85">
        {label}
        {note && <span className="block font-mono text-[11px] text-dim">{note}</span>}
      </span>
      <span className="relative h-5 border border-line">
        <span className="absolute inset-y-0 left-1/2 w-px bg-[#444]" />
        <span className="absolute inset-y-0" style={{ background: value >= 0 ? POS : NEG, left: value >= 0 ? "50%" : `${50 - share}%`, width: `${share}%` }} />
      </span>
      <span className="text-right font-mono text-sm tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

export function LstmCell() {
  const [previous, setPrevious] = useState(0.8);
  const [forget, setForget] = useState(0.9);
  const [input, setInput] = useState(0.2);
  const [candidate, setCandidate] = useState(-0.6);
  const [output, setOutput] = useState(0.7);
  const kept = forget * previous;
  const added = input * candidate;
  const cellState = kept + added;
  const hidden = output * Math.tanh(cellState);

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Old memory" value={previous} min={-1} max={1} step={0.05} onChange={setPrevious} format={(v) => v.toFixed(2)} />
          <Slider label="Forget gate" value={forget} min={0} max={1} step={0.05} onChange={setForget} format={(v) => v.toFixed(2)} />
          <Slider label="Input gate" value={input} min={0} max={1} step={0.05} onChange={setInput} format={(v) => v.toFixed(2)} />
          <Slider label="New information" value={candidate} min={-1} max={1} step={0.05} onChange={setCandidate} format={(v) => v.toFixed(2)} />
          <Slider label="Output gate" value={output} min={0} max={1} step={0.05} onChange={setOutput} format={(v) => v.toFixed(2)} />
        </>
      }
    >
      <div className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-3 p-5">
        <Bar label="Old memory" value={previous} />
        <Bar label="Kept" value={kept} note="forget gate × old memory" />
        <Bar label="Written in" value={added} note="input gate × new information" />
        <Bar label="New memory (cell state)" value={cellState} range={2} note="kept + written in" />
        <Bar label="What the cell shows the next layer" value={hidden} note="output gate × tanh(new memory)" />
      </div>
    </Frame>
  );
}

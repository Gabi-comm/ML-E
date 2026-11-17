"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Layer } from "@/lib/engine";
import { Choice, DIM, Frame, NEG, POS, Readout, Slider, curve, plot, rng, square, useCanvas } from "./ui";

const Network3D = dynamic(() => import("@/components/studio/Network3D"), { ssr: false });

// ---------------------------------------------------------------- 1. one neuron
const GATES = {
  AND: [0, 0, 0, 1],
  OR: [0, 1, 1, 1],
  XOR: [0, 1, 1, 0],
} as const;
const CORNERS: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1]];

export function Neuron() {
  const [gate, setGate] = useState<keyof typeof GATES>("AND");
  const [w1, setW1] = useState(1);
  const [w2, setW2] = useState(1);
  const [b, setB] = useState(-0.5);
  const fire = (x1: number, x2: number) => (w1 * x1 + w2 * x2 + b > 0 ? 1 : 0);
  const correct = CORNERS.filter(([x1, x2], i) => fire(x1, x2) === GATES[gate][i]).length;

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-0.5, 1.5], [-0.5, 1.5], { x: "input x₁", y: "input x₂" });
    // which side of the line makes the neuron fire
    const cell = 12;
    for (let x = p.left + cell / 2; x < p.right; x += cell) {
      for (let y = p.top + cell / 2; y < p.bottom; y += cell) {
        const a = p.x0 + ((x - p.left) / (p.right - p.left)) * 2;
        const c = p.y1 - ((y - p.top) / (p.bottom - p.top)) * 2;
        if (fire(a, c)) square(ctx, x, y, 3, "#3a3a3a");
      }
    }
    if (w2 !== 0) curve(ctx, p, (x) => -(w1 * x + b) / w2);
    else if (w1 !== 0) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.px(-b / w1), p.top);
      ctx.lineTo(p.px(-b / w1), p.bottom);
      ctx.stroke();
    }
    CORNERS.forEach(([x1, x2], i) => {
      const want = GATES[gate][i];
      const ok = fire(x1, x2) === want;
      square(ctx, p.px(x1), p.py(x2), 16, want ? POS : NEG, !want);
      if (!ok) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.strokeRect(p.px(x1) - 14, p.py(x2) - 14, 28, 28);
      }
    });
  }, [gate, w1, w2, b]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Target" value={gate} options={["AND", "OR", "XOR"] as const} onChange={setGate} />
          <Slider label="Weight w₁" value={w1} min={-2} max={2} step={0.1} onChange={setW1} format={(v) => v.toFixed(1)} />
          <Slider label="Weight w₂" value={w2} min={-2} max={2} step={0.1} onChange={setW2} format={(v) => v.toFixed(1)} />
          <Slider label="Bias b" value={b} min={-3} max={3} step={0.1} onChange={setB} format={(v) => v.toFixed(1)} />
          <Readout label="Correct" value={`${correct} / 4`} tone={correct === 4 ? "pos" : gate === "XOR" ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="A neuron's decision line over four input points" />
      <p className="label pointer-events-none absolute right-4 top-3">■ should fire · □ should stay off · boxed = wrong</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. activations
const ACTIVATIONS = {
  step: { f: (z: number) => (z >= 0 ? 1 : 0), d: () => 0 },
  sigmoid: { f: (z: number) => 1 / (1 + Math.exp(-z)), d: (z: number) => { const s = 1 / (1 + Math.exp(-z)); return s * (1 - s); } },
  tanh: { f: Math.tanh, d: (z: number) => 1 - Math.tanh(z) ** 2 },
  relu: { f: (z: number) => Math.max(0, z), d: (z: number) => (z > 0 ? 1 : 0) },
} as const;

export function Activations() {
  const [name, setName] = useState<keyof typeof ACTIVATIONS>("step");
  const [z, setZ] = useState(1);
  const fn = ACTIVATIONS[name];

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-5, 5], [-1.5, 2.5], { x: "input z", y: "output" });
    ctx.strokeStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.moveTo(p.left, p.py(0)); ctx.lineTo(p.right, p.py(0));
    ctx.moveTo(p.px(0), p.top); ctx.lineTo(p.px(0), p.bottom);
    ctx.stroke();
    curve(ctx, p, fn.d, DIM, 1.5);
    curve(ctx, p, fn.f);
    square(ctx, p.px(z), p.py(fn.f(z)), 10, POS);
  }, [name, z]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Activation" value={name} options={["step", "sigmoid", "tanh", "relu"] as const} onChange={setName} />
          <Slider label="Input z" value={z} min={-5} max={5} step={0.1} onChange={setZ} format={(v) => v.toFixed(1)} />
          <Readout label="Output" value={fn.f(z).toFixed(3)} />
          <Readout label="Slope (gradient)" value={fn.d(z).toFixed(3)} tone={fn.d(z) === 0 ? "neg" : "pos"} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Activation function and its slope" />
      <p className="label pointer-events-none absolute right-4 top-3">white = function · grey = its slope</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. train a tiny MLP
type Net = { w1: number[][]; b1: number[]; w2: number[]; b2: number };

function initNet(hidden: number, seed: number): Net {
  const r = rng(seed);
  return {
    w1: Array.from({ length: hidden }, () => [r.normal(), r.normal()]),
    b1: Array.from({ length: hidden }, () => r.normal() * 0.1),
    w2: Array.from({ length: hidden }, () => r.normal()),
    b2: 0,
  };
}

function forward(net: Net, x: [number, number]) {
  const hidden = net.w1.map((w, i) => Math.tanh(w[0] * x[0] + w[1] * x[1] + net.b1[i]));
  const out = 1 / (1 + Math.exp(-(hidden.reduce((s, v, i) => s + v * net.w2[i], 0) + net.b2)));
  return { hidden, out };
}

/** One step of backpropagation over the whole dataset. Returns the loss before the step. */
function trainStep(net: Net, data: { x: [number, number]; y: number }[], rate: number) {
  const g = { w1: net.w1.map(() => [0, 0]), b1: net.b1.map(() => 0), w2: net.w2.map(() => 0), b2: 0 };
  let loss = 0;
  for (const { x, y } of data) {
    const { hidden, out } = forward(net, x);
    loss -= y ? Math.log(out + 1e-9) : Math.log(1 - out + 1e-9);
    const dOut = out - y; // error at the output
    g.b2 += dOut;
    hidden.forEach((value, i) => {
      g.w2[i] += dOut * value;
      const dHidden = dOut * net.w2[i] * (1 - value * value); // error sent back to the hidden neuron
      g.w1[i][0] += dHidden * x[0];
      g.w1[i][1] += dHidden * x[1];
      g.b1[i] += dHidden;
    });
  }
  const n = data.length;
  net.b2 -= (rate * g.b2) / n;
  net.w2.forEach((_, i) => {
    net.w2[i] -= (rate * g.w2[i]) / n;
    net.w1[i][0] -= (rate * g.w1[i][0]) / n;
    net.w1[i][1] -= (rate * g.w1[i][1]) / n;
    net.b1[i] -= (rate * g.b1[i]) / n;
  });
  return loss / n;
}

const DATASETS = {
  XOR: CORNERS.map(([a, b], i) => ({ x: [a * 2 - 1, b * 2 - 1] as [number, number], y: GATES.XOR[i] as number })),
  circle: (() => {
    const r = rng(3);
    return Array.from({ length: 60 }, () => {
      const x: [number, number] = [r.next() * 2.4 - 1.2, r.next() * 2.4 - 1.2];
      return { x, y: Math.hypot(x[0], x[1]) < 0.75 ? 1 : 0 };
    });
  })(),
};

type TrainerSetup = {
  dataset: keyof typeof DATASETS; setDataset: (d: keyof typeof DATASETS) => void;
  hidden: number; setHidden: (h: number) => void;
  seed: number; newStart: () => void;
};

export function TinyTrainer() {
  const [dataset, setDataset] = useState<keyof typeof DATASETS>("XOR");
  const [hidden, setHidden] = useState(1);
  const [seed, setSeed] = useState(1);
  // a fresh network for every combination of settings
  return (
    <TrainerRun
      key={`${dataset}-${hidden}-${seed}`}
      dataset={dataset} setDataset={setDataset} hidden={hidden} setHidden={setHidden}
      seed={seed} newStart={() => setSeed((s) => s + 1)}
    />
  );
}

function TrainerRun({ dataset, setDataset, hidden, setHidden, seed, newStart }: TrainerSetup) {
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const net = useRef<Net>(null as unknown as Net);
  if (net.current === null) net.current = initNet(hidden, seed * 97 + hidden);
  const history = useRef<number[]>([]);
  const data = DATASETS[dataset];
  const [stats, setStats] = useState<{ correct: number; loss?: number }>(() => ({
    correct: data.filter((d) => (forward(initNet(hidden, seed * 97 + hidden), d.x).out >= 0.5 ? 1 : 0) === d.y).length,
  }));

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const loop = () => {
      let loss = 0;
      for (let i = 0; i < 12; i++) loss = trainStep(net.current, data, 0.6);
      history.current.push(loss);
      if (history.current.length > 400) history.current.shift();
      setTick((t) => t + 1);
      setStats({ loss, correct: data.filter((d) => (forward(net.current, d.x).out >= 0.5 ? 1 : 0) === d.y).length });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running, data]);

  const { correct, loss } = stats;

  const ref = useCanvas((ctx, w, h) => {
    const split = Math.min(w * 0.62, h * 1.25);
    // left: what the network currently believes, as dot-matrix pixels
    const p = plot(ctx, split, h, [-1.5, 1.5], [-1.5, 1.5], { x: "x₁", y: "x₂" });
    const cell = 12;
    for (let x = p.left + cell / 2; x < p.right; x += cell) {
      for (let y = p.top + cell / 2; y < p.bottom; y += cell) {
        const a = p.x0 + ((x - p.left) / (p.right - p.left)) * 3;
        const c = p.y1 - ((y - p.top) / (p.bottom - p.top)) * 3;
        const out = forward(net.current, [a, c]).out;
        square(ctx, x, y, 1.5 + out * 8, `rgba(255,255,255,${0.12 + out * 0.5})`);
      }
    }
    for (const d of data) square(ctx, p.px(d.x[0]), p.py(d.x[1]), 10, d.y ? POS : NEG, !d.y);
    // right: loss over time
    const values = history.current;
    const top = Math.max(0.8, ...values);
    ctx.save();
    ctx.translate(split, 0);
    const r2 = plot(ctx, w - split, h, [0, Math.max(50, values.length)], [0, Number(top.toFixed(1))], { x: "loss over time" });
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    values.forEach((v, i) => (i ? ctx.lineTo(r2.px(i), r2.py(v)) : ctx.moveTo(r2.px(i), r2.py(v))));
    ctx.stroke();
    ctx.restore();
  }, [tick, data]);

  return (
    <Frame
      tall
      controls={
        <>
          <Choice label="Data" value={dataset} options={["XOR", "circle"] as const} onChange={setDataset} />
          <Slider label="Hidden neurons" value={hidden} min={1} max={8} step={1} onChange={setHidden} />
          <button className="btn btn-solid" onClick={() => setRunning((r) => !r)}>{running ? "■ Pause" : "▶ Train"}</button>
          <button className="btn" onClick={newStart}>New start</button>
          <Readout label="Correct" value={`${correct} / ${data.length}`} tone={correct === data.length ? "pos" : undefined} />
          <Readout label="Loss" value={loss === undefined ? "–" : loss.toFixed(3)} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Decision map of a small network while it trains, with its loss" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. depth and width
export function DepthWidth() {
  const [depth, setDepth] = useState(2);
  const [width, setWidth] = useState(8);
  const layers = useMemo<Layer[]>(() => {
    const sizes = [8, ...Array.from({ length: depth }, () => width), 3];
    return sizes.map((units, i) => ({
      type: i === 0 ? "Input" : "Dense",
      units,
      activation: i === 0 ? null : i === sizes.length - 1 ? "softmax" : "relu",
      params: i === 0 ? 0 : sizes[i - 1] * units + units,
    }));
  }, [depth, width]);
  const total = layers.reduce((s, l) => s + (l.params ?? 0), 0);

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Hidden layers (depth)" value={depth} min={1} max={5} step={1} onChange={setDepth} />
          <Slider label="Neurons per layer (width)" value={width} min={2} max={64} step={1} onChange={setWidth} />
          <Readout label="Connections to learn" value={total.toLocaleString()} />
        </>
      }
    >
      <Network3D layers={layers} weights={{}} activeLine={null} training />
      <p className="label pointer-events-none absolute bottom-2 left-3">The pulse is a forward pass: input → output · drag to rotate</p>
    </Frame>
  );
}

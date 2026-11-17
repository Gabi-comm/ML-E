"use client";

import { useMemo, useState } from "react";
import { DIM, Frame, NEG, POS, Readout, Slider, plot, rng, square, useCanvas } from "./ui";

// ---------------------------------------------------------------- 1. serving and versions
export function Serving() {
  const [share, setShare] = useState(0);
  const [healthy, setHealthy] = useState(true);
  const requests = useMemo(() => {
    const r = rng(15);
    return Array.from({ length: 30 }, () => r.next());
  }, []);
  const toV2 = requests.filter((u) => u < share / 100).length;
  const failed = healthy ? 0 : toV2;
  const box = "border p-3";

  return (
    <Frame
      controls={
        <>
          <Slider label="Traffic sent to version 2" value={share} min={0} max={100} step={5} onChange={setShare} format={(v) => `${v}%`} />
          <button className="btn" onClick={() => setHealthy((h) => !h)}>{healthy ? "Break version 2" : "Fix version 2"}</button>
          <button className="btn btn-quiet" onClick={() => setShare(0)}>Roll back</button>
          <Readout label="Requests failing" value={`${failed} of 30`} tone={failed === 0 ? "pos" : "neg"} />
        </>
      }
    >
      <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center gap-4 p-5">
        <div>
          <p className="label mb-2">30 requests from apps</p>
          <div className="flex flex-wrap gap-1">
            {requests.map((u, i) => {
              const v2 = u < share / 100;
              return <span key={i} className="h-4 w-4" style={{ background: v2 ? (healthy ? POS : NEG) : "#fff" }} title={v2 ? "served by version 2" : "served by version 1"} />;
            })}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 text-dim">
          <span className="label">Model server</span>
          <span className="font-mono text-2xl" aria-hidden>▸</span>
          <span className="label">routes each request</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className={`${box} border-white`}>
            <p className="font-mono text-sm">Version 1 · current</p>
            <p className="label mt-1">{30 - toV2} requests</p>
          </div>
          <div className={`${box} ${toV2 === 0 ? "border-line text-dim" : healthy ? "border-pos" : "border-neg"}`}>
            <p className="font-mono text-sm">Version 2 · new {healthy ? "" : "· failing"}</p>
            <p className="label mt-1">{toV2} requests</p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. quantization
const WEIGHTS = (() => {
  const r = rng(909);
  return Array.from({ length: 400 }, () => r.normal() * 0.5).sort((a, b) => a - b);
})();

export function Quantize() {
  const [bits, setBits] = useState(8);
  const { quantized, error } = useMemo(() => {
    const lo = WEIGHTS[0], hi = WEIGHTS[WEIGHTS.length - 1];
    const levels = Math.pow(2, bits) - 1;
    const q = WEIGHTS.map((w) => lo + (Math.round(((w - lo) / (hi - lo)) * levels) / levels) * (hi - lo));
    return { quantized: q, error: Math.sqrt(q.reduce((s, v, i) => s + (v - WEIGHTS[i]) ** 2, 0) / q.length) };
  }, [bits]);

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, WEIGHTS.length], [-1.6, 1.6], { x: "400 weights, sorted", y: "value" });
    const path = (values: number[], color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      values.forEach((v, i) => (i ? ctx.lineTo(p.px(i), p.py(v)) : ctx.moveTo(p.px(0), p.py(v))));
      ctx.stroke();
    };
    path(WEIGHTS, "#666", 1.5);
    path(quantized, POS, 2);
  }, [quantized]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Bits per weight" value={bits} min={1} max={16} step={1} onChange={setBits} />
          <Readout label="Different values allowed" value={Math.pow(2, bits).toLocaleString()} />
          <Readout label="Size compared with 32-bit" value={`${Math.round((bits / 32) * 100)}%`} tone="pos" />
          <Readout label="Average rounding error" value={error < 0.0005 ? error.toExponential(1) : error.toFixed(3)} tone={error < 0.01 ? "pos" : error > 0.08 ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Original weights and their quantized values" />
      <p className="label pointer-events-none absolute right-4 top-3">grey = original 32-bit weights · green = after rounding</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. training on several GPUs
export function MultiGpu() {
  const [gpus, setGpus] = useState(2);
  const [overhead, setOverhead] = useState(10);
  // a simple model: each extra GPU adds a fixed share of coordination work
  const speedup = (n: number) => n / (1 + (overhead / 100) * (n - 1));
  const now = speedup(gpus);

  const ref = useCanvas((ctx, w, h) => {
    const split = w * 0.55;
    const p = plot(ctx, split, h, [1, 8], [0, 8], { x: "GPUs", y: "times faster" });
    ctx.strokeStyle = "#444";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.px(1), p.py(1));
    ctx.lineTo(p.px(8), p.py(8));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let n = 1; n <= 8; n++) {
      if (n === 1) ctx.moveTo(p.px(n), p.py(speedup(n)));
      else ctx.lineTo(p.px(n), p.py(speedup(n)));
    }
    ctx.stroke();
    square(ctx, p.px(gpus), p.py(now), 12, POS);
    // one batch split across the replicas
    const left = split + 30, width = w - split - 50, slot = width / gpus;
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = DIM;
    ctx.textAlign = "left";
    ctx.fillText("ONE BATCH OF 64, SPLIT ACROSS REPLICAS", left, 24);
    for (let g = 0; g < gpus; g++) {
      const x = left + g * slot;
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(x + 2, 40, slot - 4, h - 90);
      const per = Math.floor(64 / gpus), cols = Math.max(1, Math.floor((slot - 12) / 8));
      for (let i = 0; i < per; i++) square(ctx, x + 9 + (i % cols) * 8, 50 + Math.floor(i / cols) * 8, 5, POS);
      ctx.fillStyle = DIM;
      ctx.textAlign = "center";
      ctx.fillText(`GPU ${g + 1}`, x + slot / 2, h - 34);
    }
  }, [gpus, overhead]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Number of GPUs" value={gpus} min={1} max={8} step={1} onChange={setGpus} />
          <Slider label="Coordination overhead per extra GPU" value={overhead} min={0} max={40} step={1} onChange={setOverhead} format={(v) => `${v}%`} />
          <Readout label="Speed-up" value={`${now.toFixed(2)}×`} tone="pos" />
          <Readout label="Ideal" value={`${gpus}.00×`} />
          <Readout label="Efficiency" value={`${Math.round((now / gpus) * 100)}%`} tone={now / gpus < 0.6 ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Speed-up from adding GPUs, with a batch split across them" />
      <p className="label pointer-events-none absolute bottom-2 left-12">dashed = perfect scaling · a simplified model, not a benchmark</p>
    </Frame>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Choice, DIM, Frame, POS, Readout, Slider, plot, rng, useCanvas } from "./ui";

// ---------------------------------------------------------------- 1. shuffle, batch, repeat
/** Shuffle the way a streaming pipeline does: keep a small buffer and hand out a random item from it. */
function bufferShuffle(items: number[], size: number, seed: number) {
  if (size <= 1) return items;
  const r = rng(seed);
  const buffer: number[] = [];
  const out: number[] = [];
  for (const item of items) {
    buffer.push(item);
    if (buffer.length >= size) out.push(buffer.splice(Math.floor(r.next() * buffer.length), 1)[0]);
  }
  while (buffer.length) out.push(buffer.splice(Math.floor(r.next() * buffer.length), 1)[0]);
  return out;
}

export function Pipeline() {
  const [buffer, setBuffer] = useState(1);
  const [batch, setBatch] = useState(4);
  const [epochs, setEpochs] = useState(1);
  const [seed, setSeed] = useState(1);
  const batches = useMemo(() => {
    const stream = Array.from({ length: epochs }, (_, e) => bufferShuffle(Array.from({ length: 16 }, (_, i) => i + 1), buffer, seed * 31 + e)).flat();
    return Array.from({ length: Math.ceil(stream.length / batch) }, (_, i) => stream.slice(i * batch, (i + 1) * batch));
  }, [buffer, batch, epochs, seed]);
  // how far items moved from their original place, as a rough measure of mixing
  const first = batches.flat().slice(0, 16);
  const mixing = first.reduce((s, v, i) => s + Math.abs(v - (i + 1)), 0) / 16 / 5.3;

  return (
    <Frame
      controls={
        <>
          <Slider label="Shuffle buffer" value={buffer} min={1} max={16} step={1} onChange={setBuffer} format={(v) => (v === 1 ? "off" : String(v))} />
          <Slider label="Batch size" value={batch} min={1} max={8} step={1} onChange={setBatch} />
          <Slider label="Repeat (epochs)" value={epochs} min={1} max={3} step={1} onChange={setEpochs} />
          <button className="btn" onClick={() => setSeed((s) => s + 1)}>Reshuffle</button>
          <Readout label="Batches produced" value={String(batches.length)} />
          <Readout label="How mixed" value={`${Math.min(100, Math.round(mixing * 100))}%`} tone={mixing > 0.7 ? "pos" : mixing < 0.2 ? "neg" : undefined} />
        </>
      }
    >
      <div className="flex h-full flex-col gap-3 overflow-auto p-4">
        <div>
          <p className="label mb-1">Records on disk, in order</p>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 16 }, (_, i) => <span key={i} className="grid h-7 w-7 place-items-center border border-line font-mono text-xs text-dim">{i + 1}</span>)}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <p className="label mb-1">What the model receives, batch by batch</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {batches.map((items, i) => (
              <div key={i} className="flex gap-px border border-white/40 p-1">
                {items.map((v, j) => (
                  <span key={j} className="grid h-7 w-7 place-items-center font-mono text-xs text-black" style={{ background: `hsl(0 0% ${35 + (v / 16) * 65}%)` }}>{v}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. prefetching
export function Prefetch() {
  const [prepare, setPrepare] = useState(3);
  const [train, setTrain] = useState(4);
  const [mode, setMode] = useState<"one after the other" | "prefetch"> ("one after the other");
  const n = 6;
  const timeline = useMemo(() => {
    const cpu: [number, number][] = [], gpu: [number, number][] = [];
    let cpuFree = 0, gpuFree = 0;
    for (let i = 0; i < n; i++) {
      if (mode === "one after the other") {
        const start = Math.max(cpuFree, gpuFree);
        cpu.push([start, start + prepare]);
        gpu.push([start + prepare, start + prepare + train]);
        cpuFree = gpuFree = start + prepare + train;
      } else {
        cpu.push([cpuFree, cpuFree + prepare]);
        cpuFree += prepare;
        const start = Math.max(cpuFree, gpuFree);
        gpu.push([start, start + train]);
        gpuFree = start + train;
      }
    }
    return { cpu, gpu, total: Math.max(cpuFree, gpuFree) };
  }, [prepare, train, mode]);
  const busy = (n * train) / timeline.total;

  const ref = useCanvas((ctx, w, h) => {
    const left = 110, right = w - 16, scale = (right - left) / 72;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    const lane = (y: number, label: string, bars: [number, number][], color: string) => {
      ctx.fillStyle = DIM;
      ctx.textAlign = "left";
      ctx.fillText(label, 12, y);
      ctx.strokeStyle = "#242424";
      ctx.strokeRect(left, y - 22, right - left, 44);
      bars.forEach(([a, b], i) => {
        ctx.fillStyle = color;
        ctx.fillRect(left + a * scale + 1, y - 18, (b - a) * scale - 2, 36);
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), left + ((a + b) / 2) * scale, y);
      });
    };
    lane(h * 0.32, "CPU: prepare", timeline.cpu, "#ffffff");
    lane(h * 0.66, "GPU: train", timeline.gpu, POS);
    ctx.fillStyle = DIM;
    ctx.textAlign = "left";
    ctx.fillText("time ▸", left, h - 12);
  }, [timeline]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Pipeline" value={mode} options={["one after the other", "prefetch"] as const} onChange={setMode} />
          <Slider label="Time to prepare a batch" value={prepare} min={1} max={6} step={1} onChange={setPrepare} />
          <Slider label="Time to train on a batch" value={train} min={1} max={6} step={1} onChange={setTrain} />
          <Readout label="Total time for 6 batches" value={String(timeline.total)} tone={mode === "prefetch" ? "pos" : undefined} />
          <Readout label="GPU busy" value={`${Math.round(busy * 100)}%`} tone={busy > 0.9 ? "pos" : busy < 0.65 ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Timeline of the CPU preparing batches and the GPU training on them" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. turning categories into numbers
const CITIES = ["Manila", "Cebu", "Davao", "Manila", "Baguio", "Cebu", "Iloilo", "Manila"];
const UNIQUE = [...new Set(CITIES)];
// Illustrative 2-number embeddings: in a real model these are learned during training.
const EMBED: Record<string, [number, number]> = { Manila: [0.9, 0.8], Cebu: [0.7, -0.2], Davao: [0.5, -0.6], Baguio: [-0.8, 0.6], Iloilo: [0.1, -0.4] };
const hashOf = (text: string, bins: number) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7) % bins;

export function Categories() {
  const [method, setMethod] = useState<"lookup id" | "one-hot" | "hashing" | "embedding">("lookup id");
  const [bins, setBins] = useState(3);
  const collisions = UNIQUE.length - new Set(UNIQUE.map((c) => hashOf(c, bins))).size;
  const width = method === "one-hot" ? UNIQUE.length : method === "embedding" ? 2 : 1;
  const cell = "border border-line px-2 py-1 text-center font-mono text-sm tabular-nums";

  const encode = (city: string): (number | string)[] => {
    if (method === "lookup id") return [UNIQUE.indexOf(city)];
    if (method === "hashing") return [hashOf(city, bins)];
    if (method === "one-hot") return UNIQUE.map((u) => (u === city ? 1 : 0));
    return EMBED[city].map((v) => v.toFixed(1));
  };

  return (
    <Frame
      controls={
        <>
          <Choice label="Encoding" value={method} options={["lookup id", "one-hot", "hashing", "embedding"] as const} onChange={setMethod} />
          {method === "hashing" && <Slider label="Hash bins" value={bins} min={2} max={12} step={1} onChange={setBins} />}
          <Readout label="Numbers per row" value={String(width)} />
          {method === "hashing" && <Readout label="Cities sharing a bin" value={String(collisions)} tone={collisions ? "neg" : "pos"} />}
          <span className="max-w-xs text-sm text-dim">
            {method === "lookup id" && "Needs the full list of categories in advance. The numbers imply an order that is not real."}
            {method === "one-hot" && "No false order, but one column per category. Fine for a few, heavy for thousands."}
            {method === "hashing" && "No list needed, so new categories still work. The cost: different cities can collide."}
            {method === "embedding" && "A few learned numbers per category. Similar categories end up with similar numbers. Values here are illustrative."}
          </span>
        </>
      }
    >
      <div className="flex h-full items-center justify-center overflow-auto p-4">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="label px-2 pb-1 text-left">city</th>
              <th className="px-3" />
              {method === "one-hot" ? UNIQUE.map((u) => <th key={u} className="label px-1 pb-1">{u}</th>) : <th className="label px-2 pb-1" colSpan={width}>model input</th>}
            </tr>
          </thead>
          <tbody>
            {CITIES.map((city, i) => (
              <tr key={i}>
                <td className="border border-line px-3 py-1 font-mono text-sm">{city}</td>
                <td className="px-3 text-dim">▸</td>
                {encode(city).map((v, j) => (
                  <td key={j} className={`${cell} ${v === 0 ? "text-faint" : "text-pos"}`}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. reshaping a skewed feature
const INCOMES = (() => {
  const r = rng(63);
  return Array.from({ length: 600 }, () => Math.exp(10 + r.normal() * 0.8)); // long right tail, like real incomes
})();

export function Reshape() {
  const [method, setMethod] = useState<"raw" | "standardized" | "log, then standardized" | "buckets">("raw");
  const [buckets, setBuckets] = useState(5);
  const { values, lo, hi } = useMemo(() => {
    const standardize = (v: number[]) => {
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length);
      return v.map((x) => (x - mean) / sd);
    };
    if (method === "raw") return { values: INCOMES, lo: 0, hi: 200000 };
    if (method === "standardized") return { values: standardize(INCOMES), lo: -3, hi: 8 };
    if (method === "log, then standardized") return { values: standardize(INCOMES.map(Math.log)), lo: -4, hi: 4 };
    const sorted = [...INCOMES].sort((a, b) => a - b);
    const edges = Array.from({ length: buckets - 1 }, (_, i) => sorted[Math.floor(((i + 1) * sorted.length) / buckets)]);
    return { values: INCOMES.map((v) => edges.filter((e) => v >= e).length), lo: -0.5, hi: buckets - 0.5 };
  }, [method, buckets]);

  const bins = method === "buckets" ? buckets : 40;
  const counts = useMemo(() => {
    const c = new Array<number>(bins).fill(0);
    for (const v of values) {
      const i = Math.floor(((v - lo) / (hi - lo)) * bins);
      if (i >= 0 && i < bins) c[i] += 1;
    }
    return c;
  }, [values, lo, hi, bins]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const skew = values.reduce((s, v) => s + (v - mean) ** 3, 0) / values.length / Math.pow(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length, 1.5);

  const ref = useCanvas((ctx, w, h) => {
    const top = Math.max(...counts);
    const p = plot(ctx, w, h, [lo, hi], [0, top], { x: method === "buckets" ? "bucket number" : "value fed to the model", y: "how many" });
    const bw = (p.right - p.left) / bins;
    counts.forEach((c, i) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(p.left + i * bw + 1, p.py(c), bw - 2, p.bottom - p.py(c));
    });
  }, [counts, lo, hi, method]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Preprocessing" value={method} options={["raw", "standardized", "log, then standardized", "buckets"] as const} onChange={setMethod} />
          {method === "buckets" && <Slider label="Number of buckets" value={buckets} min={2} max={12} step={1} onChange={setBuckets} />}
          <Readout label="Lopsidedness (skew)" value={skew.toFixed(2)} tone={Math.abs(skew) < 0.3 ? "pos" : Math.abs(skew) > 1.5 ? "neg" : undefined} />
          <Readout label="Largest value" value={Math.max(...values) > 1000 ? Math.round(Math.max(...values)).toLocaleString() : Math.max(...values).toFixed(1)} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Histogram of a skewed feature after preprocessing" />
    </Frame>
  );
}


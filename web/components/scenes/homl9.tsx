"use client";

import { useEffect, useMemo, useState } from "react";
import { BLUE, Choice, DIM, Frame, NEG, POS, Readout, Slider, dotMap, plot, rng, square, useCanvas } from "./ui";

type P = { x: number; y: number };
const PALETTE = [POS, NEG, BLUE, "#ffd166", "#c792ea", "#ff9f68", "#5eead4", "#f8f8f8"];
const dist2 = (a: P, b: P) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// ---------------------------------------------------------------- k-means core
const FOUR_BLOBS: P[] = (() => {
  const r = rng(19);
  const spec: [number, number, number, number][] = [[-2, 1.6, 0.45, 34], [1.9, 1.7, 0.6, 30], [-0.6, -1.6, 0.5, 30], [2.3, -1.4, 0.35, 22]];
  return spec.flatMap(([cx, cy, sd, n]) => Array.from({ length: n }, () => ({ x: cx + r.normal() * sd, y: cy + r.normal() * sd })));
})();

const assign = (p: P, centres: P[]) => centres.reduce((best, c, i) => (dist2(p, c) < dist2(p, centres[best]) ? i : best), 0);
const inertiaOf = (data: P[], centres: P[]) => data.reduce((s, p) => s + dist2(p, centres[assign(p, centres)]), 0);

function kMeans(data: P[], k: number, seed: number, iterations: number) {
  const r = rng(seed * 7919 + k);
  let centres = Array.from({ length: k }, () => ({ ...data[Math.floor(r.next() * data.length)] }));
  for (let i = 0; i < iterations; i++) {
    centres = centres.map((c, j) => {
      const mine = data.filter((p) => assign(p, centres) === j);
      return mine.length ? { x: mine.reduce((s, p) => s + p.x, 0) / mine.length, y: mine.reduce((s, p) => s + p.y, 0) / mine.length } : c;
    });
  }
  return centres;
}

function drawClusters(ctx: CanvasRenderingContext2D, w: number, h: number, data: P[], centres: P[]) {
  const p = plot(ctx, w, h, [-4, 4], [-3.5, 3.5]);
  dotMap(ctx, p, (x, y) => ({ size: 0.1, color: PALETTE[assign({ x, y }, centres) % 8] + "55" }));
  for (const d of data) square(ctx, p.px(d.x), p.py(d.y), 6, PALETTE[assign(d, centres) % 8]);
  centres.forEach((c, i) => {
    square(ctx, p.px(c.x), p.py(c.y), 18, "#000");
    square(ctx, p.px(c.x), p.py(c.y), 18, PALETTE[i % 8], true);
  });
  return p;
}

// ---------------------------------------------------------------- 1. k-means step by step
export function KMeansSteps() {
  const [k, setK] = useState(4);
  const [seed, setSeed] = useState(1);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const centres = useMemo(() => kMeans(FOUR_BLOBS, k, seed, step), [k, seed, step]);
  const inertia = inertiaOf(FOUR_BLOBS, centres);

  useEffect(() => {
    if (!running) return;
    let n = step;
    const timer = setInterval(() => {
      n += 1;
      setStep(n);
      if (n >= 12) {
        clearInterval(timer);
        setRunning(false);
      }
    }, 450);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const ref = useCanvas((ctx, w, h) => void drawClusters(ctx, w, h, FOUR_BLOBS, centres), [centres]);
  const restart = (change: () => void) => { change(); setStep(0); setRunning(false); };

  return (
    <Frame
      controls={
        <>
          <Slider label="Clusters k" value={k} min={1} max={8} step={1} onChange={(v) => restart(() => setK(v))} />
          <button className="btn" onClick={() => setStep((s) => s + 1)} disabled={running}>Step</button>
          <button className="btn btn-solid" onClick={() => setRunning(true)} disabled={running}>▶ Run</button>
          <button className="btn" onClick={() => restart(() => setSeed((s) => s + 1))}>New random start</button>
          <Readout label="Round" value={String(step)} />
          <Readout label="Inertia (lower = tighter)" value={inertia.toFixed(1)} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="K-means centroids and assignments" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. choosing k
const BEST_BY_K = Array.from({ length: 9 }, (_, i) => {
  const k = i + 1;
  let best: P[] = [];
  let bestInertia = Infinity;
  for (let seed = 1; seed <= 8; seed++) {
    const centres = kMeans(FOUR_BLOBS, k, seed, 25);
    const value = inertiaOf(FOUR_BLOBS, centres);
    if (value < bestInertia) { bestInertia = value; best = centres; }
  }
  return { k, centres: best, inertia: bestInertia };
});

export function Elbow() {
  const [k, setK] = useState(2);
  const chosen = BEST_BY_K[k - 1];
  const drop = k > 1 ? BEST_BY_K[k - 2].inertia - chosen.inertia : 0;

  const ref = useCanvas((ctx, w, h) => {
    const split = w * 0.58;
    drawClusters(ctx, split, h, FOUR_BLOBS, chosen.centres);
    ctx.save();
    ctx.translate(split, 0);
    const top = Math.ceil(BEST_BY_K[0].inertia / 100) * 100;
    const q = plot(ctx, w - split, h, [1, 9], [0, top], { x: "clusters k", y: "inertia" });
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    BEST_BY_K.forEach((b, i) => (i ? ctx.lineTo(q.px(b.k), q.py(b.inertia)) : ctx.moveTo(q.px(b.k), q.py(b.inertia))));
    ctx.stroke();
    BEST_BY_K.forEach((b) => square(ctx, q.px(b.k), q.py(b.inertia), b.k === k ? 12 : 6, b.k === k ? POS : "#fff"));
    ctx.restore();
  }, [k]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Clusters k" value={k} min={1} max={9} step={1} onChange={setK} />
          <Readout label="Inertia" value={chosen.inertia.toFixed(1)} />
          <Readout label="Gained by adding this cluster" value={k === 1 ? "–" : drop.toFixed(1)} tone={k > 1 && drop > 40 ? "pos" : k > 1 ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Clusters for the chosen k next to the inertia curve" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. DBSCAN
const CRESCENTS: P[] = (() => {
  const r = rng(27);
  const points: P[] = Array.from({ length: 280 }, (_, i) => {
    const a = Math.PI * r.next();
    const top = i % 2 === 0;
    return {
      x: ((top ? Math.cos(a) : 1 - Math.cos(a)) - 0.5) * 2 + r.normal() * 0.09,
      y: ((top ? Math.sin(a) : 0.5 - Math.sin(a)) - 0.25) * 2 + r.normal() * 0.09,
    };
  });
  for (let i = 0; i < 10; i++) points.push({ x: r.next() * 7 - 3.5, y: r.next() * 6 - 3 });
  return points;
})();

/** Standard DBSCAN. Returns a cluster id per point, or -1 for noise, plus which points are core points. */
function dbscan(data: P[], eps: number, minPts: number) {
  const neighbours = data.map((p) => data.map((q, j) => (dist2(p, q) <= eps * eps ? j : -1)).filter((j) => j >= 0));
  const core = neighbours.map((n) => n.length >= minPts);
  const labels = new Array<number>(data.length).fill(-1);
  let cluster = 0;
  for (let i = 0; i < data.length; i++) {
    if (labels[i] !== -1 || !core[i]) continue;
    const queue = [i];
    labels[i] = cluster;
    while (queue.length) {
      const current = queue.pop()!;
      if (!core[current]) continue;
      for (const j of neighbours[current]) {
        if (labels[j] === -1) {
          labels[j] = cluster;
          queue.push(j);
        }
      }
    }
    cluster += 1;
  }
  return { labels, core, clusters: cluster };
}

export function Dbscan() {
  const [method, setMethod] = useState<"k-means (k = 2)" | "DBSCAN">("k-means (k = 2)");
  const [eps, setEps] = useState(0.45);
  const [minPts, setMinPts] = useState(5);
  const kCentres = useMemo(() => kMeans(CRESCENTS, 2, 3, 25), []);
  const result = useMemo(() => dbscan(CRESCENTS, eps, minPts), [eps, minPts]);
  const noise = result.labels.filter((l) => l === -1).length;

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-4, 4], [-3.5, 3.5]);
    CRESCENTS.forEach((d, i) => {
      if (method === "DBSCAN") {
        const label = result.labels[i];
        if (label === -1) square(ctx, p.px(d.x), p.py(d.y), 7, DIM, true);
        else square(ctx, p.px(d.x), p.py(d.y), result.core[i] ? 7 : 4, PALETTE[label % 8]);
      } else {
        square(ctx, p.px(d.x), p.py(d.y), 7, PALETTE[assign(d, kCentres)]);
      }
    });
    if (method === "DBSCAN") {
      // the reach of one point, to show what eps means
      const d = CRESCENTS[0];
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.px(d.x), p.py(d.y), Math.abs(p.px(eps) - p.px(0)), 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [method, result, eps, kCentres]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Method" value={method} options={["k-means (k = 2)", "DBSCAN"] as const} onChange={setMethod} />
          {method === "DBSCAN" && (
            <>
              <Slider label="Reach ε" value={eps} min={0.05} max={1} step={0.01} onChange={setEps} format={(v) => v.toFixed(2)} />
              <Slider label="Neighbours needed" value={minPts} min={2} max={15} step={1} onChange={setMinPts} />
              <Readout label="Clusters found" value={String(result.clusters)} tone={result.clusters === 2 ? "pos" : "neg"} />
              <Readout label="Marked as noise" value={String(noise)} />
            </>
          )}
          {method !== "DBSCAN" && <span className="max-w-sm text-sm text-dim">K-means assumes round blobs, so it cuts each crescent in half.</span>}
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Two crescent-shaped clusters grouped by k-means or DBSCAN" />
      {method === "DBSCAN" && <p className="label pointer-events-none absolute right-4 top-3">circle = one point&apos;s reach · hollow grey = noise · small = border point</p>}
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. Gaussian mixture + anomalies
const MIX_DATA: P[] = (() => {
  const r = rng(45);
  const points: P[] = [];
  for (let i = 0; i < 70; i++) {
    const a = r.normal() * 1.1, b = r.normal() * 0.3;
    points.push({ x: -1.5 + a * 0.8 - b * 0.6, y: 0.8 + a * 0.6 + b * 0.8 });
  }
  for (let i = 0; i < 60; i++) points.push({ x: 1.7 + r.normal() * 0.5, y: -1.1 + r.normal() * 0.8 });
  for (const p of [[3.2, 2.6], [-3.3, -2.5], [0.2, 2.9], [-0.3, -0.4], [3.4, -3], [-3.4, 2.9]]) points.push({ x: p[0], y: p[1] });
  return points;
})();

type Gaussian = { weight: number; mean: P; a: number; b: number; d: number };
const pdf = (g: Gaussian, p: P) => {
  const det = g.a * g.d - g.b * g.b;
  const dx = p.x - g.mean.x, dy = p.y - g.mean.y;
  const q = (g.d * dx * dx - 2 * g.b * dx * dy + g.a * dy * dy) / det;
  return Math.exp(-0.5 * q) / (2 * Math.PI * Math.sqrt(det));
};

/** Fit two Gaussians with the EM algorithm. */
const MIXTURE: Gaussian[] = (() => {
  let parts: Gaussian[] = [
    { weight: 0.5, mean: { x: -1, y: 0 }, a: 1, b: 0, d: 1 },
    { weight: 0.5, mean: { x: 1, y: 0 }, a: 1, b: 0, d: 1 },
  ];
  for (let it = 0; it < 60; it++) {
    const resp = MIX_DATA.map((p) => {
      const each = parts.map((g) => g.weight * pdf(g, p));
      const total = each[0] + each[1] || 1e-300;
      return each.map((e) => e / total);
    });
    parts = parts.map((_, k) => {
      const n = resp.reduce((s, r) => s + r[k], 0);
      const mean = { x: MIX_DATA.reduce((s, p, i) => s + resp[i][k] * p.x, 0) / n, y: MIX_DATA.reduce((s, p, i) => s + resp[i][k] * p.y, 0) / n };
      let a = 1e-4, b = 0, d = 1e-4;
      MIX_DATA.forEach((p, i) => {
        const dx = p.x - mean.x, dy = p.y - mean.y;
        a += (resp[i][k] * dx * dx) / n;
        b += (resp[i][k] * dx * dy) / n;
        d += (resp[i][k] * dy * dy) / n;
      });
      return { weight: n / MIX_DATA.length, mean, a, b, d };
    });
  }
  return parts;
})();
const density = (p: P) => MIXTURE[0].weight * pdf(MIXTURE[0], p) + MIXTURE[1].weight * pdf(MIXTURE[1], p);
const DENSITIES = MIX_DATA.map(density);
const SORTED = [...DENSITIES].sort((a, b) => a - b);

export function Mixture() {
  const [percent, setPercent] = useState(0);
  const cut = percent === 0 ? -1 : SORTED[Math.min(SORTED.length - 1, Math.ceil((percent / 100) * SORTED.length) - 1)];
  const flagged = DENSITIES.filter((d) => d <= cut).length;

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-4.5, 4.5], [-3.8, 3.8]);
    dotMap(ctx, p, (x, y) => {
      const level = Math.min(1, Math.max(0, (Math.log10(density({ x, y }) + 1e-12) + 4) / 3.4));
      return level <= 0.02 ? null : { size: level * 0.75, color: `rgba(255,255,255,${0.1 + level * 0.3})` };
    });
    MIX_DATA.forEach((d, i) => {
      const odd = DENSITIES[i] <= cut;
      square(ctx, p.px(d.x), p.py(d.y), 6, odd ? NEG : "#fff");
      if (odd) {
        ctx.strokeStyle = NEG;
        ctx.lineWidth = 1;
        ctx.strokeRect(p.px(d.x) - 8, p.py(d.y) - 8, 16, 16);
      }
    });
    for (const g of MIXTURE) square(ctx, p.px(g.mean.x), p.py(g.mean.y), 14, POS, true);
  }, [cut]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Flag the least likely" value={percent} min={0} max={20} step={1} onChange={setPercent} format={(v) => `${v}%`} />
          <Readout label="Flagged as anomalies" value={String(flagged)} tone={flagged > 0 ? "neg" : undefined} />
          <span className="max-w-sm text-sm text-dim">Two Gaussians fitted to these points with EM. Brighter background = where the model expects data.</span>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Gaussian mixture density with low-density points flagged" />
    </Frame>
  );
}

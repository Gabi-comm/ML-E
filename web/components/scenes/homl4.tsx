"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { DIM, Frame, NEG, POS, Readout, Slider, Stage3D, curve, plot, rng, square, useCanvas } from "./ui";

// ---------------------------------------------------------------- shared data
// y = 4 + 3x + noise: a straight-line relationship the model has to discover.
const LINE_DATA = (() => {
  const r = rng(7);
  return Array.from({ length: 40 }, () => {
    const x = r.next() * 2;
    return { x, y: 4 + 3 * x + r.normal() * 0.9 };
  });
})();

function mse(t0: number, t1: number, data = LINE_DATA) {
  let sum = 0;
  for (const p of data) sum += (t0 + t1 * p.x - p.y) ** 2;
  return sum / data.length;
}

function gradient(t0: number, t1: number, data = LINE_DATA): [number, number] {
  let g0 = 0, g1 = 0;
  for (const p of data) {
    const e = t0 + t1 * p.x - p.y;
    g0 += e;
    g1 += e * p.x;
  }
  return [(2 * g0) / data.length, (2 * g1) / data.length];
}

const BEST = (() => {
  const n = LINE_DATA.length;
  const mx = LINE_DATA.reduce((s, p) => s + p.x, 0) / n;
  const my = LINE_DATA.reduce((s, p) => s + p.y, 0) / n;
  const t1 = LINE_DATA.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / LINE_DATA.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  return { t0: my - t1 * mx, t1 };
})();

// ---------------------------------------------------------------- 1. line fit
export function LineFit() {
  const [t0, setT0] = useState(1);
  const [t1, setT1] = useState(0.5);
  const error = mse(t0, t1);
  const best = mse(BEST.t0, BEST.t1);

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, 2], [0, 14], { x: "x", y: "y" });
    for (const d of LINE_DATA) {
      const predicted = t0 + t1 * d.x;
      ctx.strokeStyle = predicted > d.y ? NEG : POS;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(p.px(d.x), p.py(d.y));
      ctx.lineTo(p.px(d.x), p.py(Math.max(0, Math.min(14, predicted))));
      ctx.stroke();
      ctx.globalAlpha = 1;
      square(ctx, p.px(d.x), p.py(d.y), 5, "#fff");
    }
    curve(ctx, p, (x) => t0 + t1 * x);
  }, [t0, t1]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Intercept θ₀" value={t0} min={0} max={8} step={0.1} onChange={setT0} format={(v) => v.toFixed(1)} />
          <Slider label="Slope θ₁" value={t1} min={-2} max={6} step={0.1} onChange={setT1} format={(v) => v.toFixed(1)} />
          <Readout label="Error (MSE)" value={error.toFixed(2)} tone={error < best * 1.15 ? "pos" : undefined} />
          <Readout label="Best possible" value={best.toFixed(2)} />
          <button className="btn" onClick={() => { setT0(Number(BEST.t0.toFixed(1))); setT1(Number(BEST.t1.toFixed(1))); }}>
            Snap to best
          </button>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Scatter plot with an adjustable line and its errors" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. 3D descent
const T0_RANGE: [number, number] = [-2, 10];
const T1_RANGE: [number, number] = [-3, 9];
const toScene = (t0: number, t1: number): [number, number, number] => [
  ((t0 - T0_RANGE[0]) / (T0_RANGE[1] - T0_RANGE[0])) * 6 - 3,
  Math.min(4, 0.9 * Math.log1p(mse(t0, t1))),
  ((t1 - T1_RANGE[0]) / (T1_RANGE[1] - T1_RANGE[0])) * 6 - 3,
];

function Surface() {
  const geometry = useMemo(() => {
    const n = 36;
    const positions: number[] = [];
    const point = (i: number, j: number) =>
      toScene(T0_RANGE[0] + ((T0_RANGE[1] - T0_RANGE[0]) * i) / n, T1_RANGE[0] + ((T1_RANGE[1] - T1_RANGE[0]) * j) / n);
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        if (i < n) positions.push(...point(i, j), ...point(i + 1, j));
        if (j < n) positions.push(...point(i, j), ...point(i, j + 1));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#4a4a4a" />
    </lineSegments>
  );
}

function Trail({ path }: { path: [number, number][] }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const points = path.map(([a, b]) => {
      const [x, y, z] = toScene(a, b);
      return new THREE.Vector3(x, y + 0.04, z);
    });
    g.setFromPoints(points);
    return g;
  }, [path]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const last = path[path.length - 1];
  const [x, y, z] = toScene(last[0], last[1]);
  return (
    <>
      {/* @ts-expect-error three's <line> clashes with the SVG element type */}
      <line geometry={geometry}>
        <lineBasicMaterial color="#ffffff" />
      </line>
      <mesh position={[x, y + 0.12, z]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshBasicMaterial color={POS} />
      </mesh>
    </>
  );
}

export function DescentSurface() {
  const [rate, setRate] = useState(0.1);
  const [run, setRun] = useState(0);
  const [path, setPath] = useState<[number, number][]>([[9, -2]]);

  useEffect(() => {
    const start: [number, number] = [9, -2];
    let current = start;
    let steps = 0;
    const timer = setInterval(() => {
      const [g0, g1] = gradient(current[0], current[1]);
      current = [current[0] - rate * g0, current[1] - rate * g1];
      steps += 1;
      const escaped = !Number.isFinite(current[0]) || Math.abs(current[0]) > 60 || Math.abs(current[1]) > 60;
      if (escaped || steps > 120) return clearInterval(timer);
      const point = current;
      // the first tick also clears the previous run's trail
      setPath((p) => (steps === 1 ? [start, point] : [...p, point]));
    }, 110);
    return () => clearInterval(timer);
  }, [rate, run]);

  const [t0, t1] = path[path.length - 1];
  const loss = mse(t0, t1);
  const diverging = path.length > 3 && loss > mse(path[0][0], path[0][1]);

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Learning rate η" value={rate} min={0.01} max={0.5} step={0.01} onChange={setRate} format={(v) => v.toFixed(2)} />
          <Readout label="Step" value={String(path.length - 1)} />
          <Readout label="Loss" value={loss > 9999 ? "exploding" : loss.toFixed(2)} tone={diverging ? "neg" : loss < 1.2 ? "pos" : undefined} />
          <button className="btn" onClick={() => setRun((r) => r + 1)}>Restart</button>
        </>
      }
    >
      <Stage3D camera={[6, 5, 7]}>
        <Surface />
        <Trail path={path} />
      </Stage3D>
      <p className="label pointer-events-none absolute bottom-2 left-3">Height = error · floor = θ₀ and θ₁ · drag to rotate</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. batch vs sgd
function descend(kind: "batch" | "stochastic" | "mini-batch", seed: number) {
  const r = rng(seed);
  let t: [number, number] = [8.5, -1.5];
  const path: [number, number][] = [t];
  for (let step = 0; step < 90; step++) {
    const size = kind === "batch" ? LINE_DATA.length : kind === "stochastic" ? 1 : 8;
    const sample = kind === "batch" ? LINE_DATA : Array.from({ length: size }, () => LINE_DATA[Math.floor(r.next() * LINE_DATA.length)]);
    const [g0, g1] = gradient(t[0], t[1], sample);
    const rate = kind === "batch" ? 0.1 : 0.06;
    t = [t[0] - rate * g0, t[1] - rate * g1];
    path.push(t);
  }
  return path;
}

export function DescentPaths() {
  const [seed, setSeed] = useState(1);
  const [frame, setFrame] = useState(0);
  const paths = useMemo(
    () => ({ batch: descend("batch", seed), stochastic: descend("stochastic", seed + 11), "mini-batch": descend("mini-batch", seed + 23) }),
    [seed],
  );

  useEffect(() => {
    let f = 0;
    const timer = setInterval(() => {
      setFrame(f);
      if (f++ >= 90) clearInterval(timer);
    }, 60);
    return () => clearInterval(timer);
  }, [seed]);

  const colors = { batch: "#ffffff", "mini-batch": POS, stochastic: NEG } as const;

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, 9], [-2, 6], { x: "θ₀", y: "θ₁" });
    // the error landscape as dot-matrix pixels: brighter = lower error
    const cell = 12;
    for (let x = p.left + cell / 2; x < p.right; x += cell) {
      for (let y = p.top + cell / 2; y < p.bottom; y += cell) {
        const a = p.x0 + ((x - p.left) / (p.right - p.left)) * (p.x1 - p.x0);
        const b = p.y1 - ((y - p.top) / (p.bottom - p.top)) * (p.y1 - p.y0);
        const level = Math.max(0, 1 - Math.log1p(mse(a, b)) / 4.2);
        const size = 1.5 + level * 7;
        const shade = Math.round(40 + level * 110);
        square(ctx, x, y, size, `rgb(${shade},${shade},${shade})`);
      }
    }
    (Object.keys(paths) as (keyof typeof paths)[]).forEach((kind) => {
      const path = paths[kind].slice(0, frame + 1);
      ctx.strokeStyle = colors[kind];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      path.forEach(([a, b], i) => (i ? ctx.lineTo(p.px(a), p.py(b)) : ctx.moveTo(p.px(a), p.py(b))));
      ctx.stroke();
      const [a, b] = path[path.length - 1];
      square(ctx, p.px(a), p.py(b), 8, colors[kind]);
    });
    square(ctx, p.px(BEST.t0), p.py(BEST.t1), 12, "#fff", true);
  }, [paths, frame]);

  return (
    <Frame
      tall
      controls={
        <>
          {(Object.keys(colors) as (keyof typeof colors)[]).map((kind) => (
            <span key={kind} className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
              <span className="inline-block h-2.5 w-2.5" style={{ background: colors[kind] }} />
              {kind}
              <span className="text-dim">{kind === "batch" ? "all 40 points" : kind === "stochastic" ? "1 point" : "8 points"} per step</span>
            </span>
          ))}
          <button className="btn ml-auto" onClick={() => setSeed((s) => s + 1)}>Race again</button>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Three gradient descent paths on the error landscape" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 4/5. polynomial
const CURVE_DATA = (() => {
  const r = rng(21);
  const make = (n: number) =>
    Array.from({ length: n }, () => {
      const x = r.next() * 6 - 3;
      return { x, y: 0.5 * x * x + x + 2 + r.normal() * 1.1 };
    });
  return { train: make(16), validation: make(30) };
})();

/** Least squares with optional ridge penalty, solved by Gaussian elimination. */
export function fitPolynomial(points: { x: number; y: number }[], degree: number, alpha: number) {
  const n = degree + 1;
  const A = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  for (const { x, y } of points) {
    const powers = Array.from({ length: n }, (_, i) => (x / 3) ** i);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] += powers[i] * powers[j];
      A[i][n] += powers[i] * y;
    }
  }
  for (let i = 1; i < n; i++) A[i][i] += alpha; // the intercept is not penalised
  for (let i = 0; i < n; i++) A[i][i] += 1e-9;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col] / A[col][col];
      for (let k = col; k <= n; k++) A[row][k] -= factor * A[col][k];
    }
  }
  const theta = A.map((row, i) => row[n] / row[i]);
  return (x: number) => theta.reduce((sum, t, i) => sum + t * (x / 3) ** i, 0);
}

export const rmse = (f: (x: number) => number, points: { x: number; y: number }[]) =>
  Math.sqrt(points.reduce((s, p) => s + (f(p.x) - p.y) ** 2, 0) / points.length);

export function PolyFit({ ridge = false }: { ridge?: boolean }) {
  const [degree, setDegree] = useState(ridge ? 12 : 1);
  const [strength, setStrength] = useState(0); // slider position; alpha = 10^(strength) scaled
  const alpha = ridge && strength > 0 ? 10 ** (strength - 5) : 0;
  const model = useMemo(() => fitPolynomial(CURVE_DATA.train, degree, alpha), [degree, alpha]);
  const trainError = rmse(model, CURVE_DATA.train);
  const validationError = rmse(model, CURVE_DATA.validation);
  const verdict = validationError > trainError * 1.6 ? "Overfitting" : trainError > 1.6 ? "Underfitting" : "Good fit";

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-3, 3], [-2, 12], { x: "x", y: "y" });
    for (const d of CURVE_DATA.validation) square(ctx, p.px(d.x), p.py(d.y), 5, DIM, true);
    for (const d of CURVE_DATA.train) square(ctx, p.px(d.x), p.py(d.y), 6, "#fff");
    curve(ctx, p, model, POS);
  }, [model]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Polynomial degree" value={degree} min={1} max={14} step={1} onChange={setDegree} />
          {ridge && (
            <Slider label="Ridge strength α" value={strength} min={0} max={6} step={0.25} onChange={setStrength} format={() => (alpha === 0 ? "off" : alpha.toPrecision(2))} />
          )}
          <Readout label="Training error" value={trainError.toFixed(2)} />
          <Readout label="New-data error" value={validationError > 99 ? "huge" : validationError.toFixed(2)} tone={verdict === "Good fit" ? "pos" : verdict === "Overfitting" ? "neg" : undefined} />
          <Readout label="Verdict" value={verdict} tone={verdict === "Good fit" ? "pos" : "neg"} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Polynomial curve fitted to training points" />
      <p className="label pointer-events-none absolute right-4 top-3">■ training points · □ new data</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 6. logistic
const CLASS_DATA = (() => {
  const r = rng(5);
  return Array.from({ length: 36 }, (_, i) => {
    const label = i % 2;
    return { x: (label ? 1.9 : 1.1) + r.normal() * 0.35, label };
  });
})();
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function Logistic() {
  const [w, setW] = useState(1);
  const [b, setB] = useState(0);
  const loss = -CLASS_DATA.reduce((s, d) => {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, sigmoid(w * d.x + b)));
    return s + (d.label ? Math.log(p) : Math.log(1 - p));
  }, 0) / CLASS_DATA.length;
  const correct = CLASS_DATA.filter((d) => (sigmoid(w * d.x + b) >= 0.5 ? 1 : 0) === d.label).length;
  const boundary = w !== 0 ? -b / w : NaN;

  const fit = () => {
    let cw = w, cb = b;
    for (let i = 0; i < 4000; i++) {
      let gw = 0, gb = 0;
      for (const d of CLASS_DATA) {
        const e = sigmoid(cw * d.x + cb) - d.label;
        gw += e * d.x;
        gb += e;
      }
      cw -= (0.5 * gw) / CLASS_DATA.length;
      cb -= (0.5 * gb) / CLASS_DATA.length;
    }
    setW(Number(cw.toFixed(1)));
    setB(Number(cb.toFixed(1)));
  };

  const ref = useCanvas((ctx, width, height) => {
    const p = plot(ctx, width, height, [0, 3], [0, 1], { x: "feature", y: "probability" });
    ctx.strokeStyle = "#333";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.left, p.py(0.5));
    ctx.lineTo(p.right, p.py(0.5));
    if (boundary > 0 && boundary < 3) {
      ctx.moveTo(p.px(boundary), p.top);
      ctx.lineTo(p.px(boundary), p.bottom);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    curve(ctx, p, (x) => sigmoid(w * x + b));
    CLASS_DATA.forEach((d, i) => {
      const y = d.label ? p.py(1) + 10 + (i % 5) * 5 : p.py(0) - 10 - (i % 5) * 5;
      square(ctx, p.px(d.x), y, 6, d.label ? POS : NEG);
    });
  }, [w, b]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Weight w" value={w} min={-10} max={20} step={0.1} onChange={setW} format={(v) => v.toFixed(1)} />
          <Slider label="Bias b" value={b} min={-30} max={10} step={0.1} onChange={setB} format={(v) => v.toFixed(1)} />
          <Readout label="Correct" value={`${correct} / ${CLASS_DATA.length}`} tone={correct >= 33 ? "pos" : undefined} />
          <Readout label="Log loss" value={loss.toFixed(3)} />
          <button className="btn" onClick={fit}>Train it</button>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Sigmoid curve separating two classes" />
    </Frame>
  );
}

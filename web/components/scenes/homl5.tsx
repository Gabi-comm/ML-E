"use client";

import { useMemo, useState } from "react";
import * as THREE from "three";
import { Frame, NEG, POS, Readout, Slider, Stage3D, dotMap, line, plot, rng, square, useCanvas } from "./ui";

type Pt = { x: number; y: number; label: 1 | -1 };

// ---------------------------------------------------------------- 1. margin
const TWO_GROUPS: Pt[] = (() => {
  const r = rng(8);
  const make = (cx: number, cy: number, label: 1 | -1) =>
    Array.from({ length: 28 }, () => ({ x: cx + r.normal() * 0.75, y: cy + r.normal() * 0.75, label }));
  return [...make(1.15, 1.15, 1), ...make(-1.15, -1.15, -1)];
})();

/** Linear SVM trained by subgradient descent on the hinge loss. */
function trainSvm(data: Pt[], c: number) {
  const lambda = 1 / (c * data.length);
  let w1 = 0, w2 = 0, b = 0;
  for (let t = 1; t <= 3000; t++) {
    const rate = Math.min(0.2, 1 / (lambda * t));
    let g1 = lambda * w1, g2 = lambda * w2, gb = 0;
    for (const p of data) {
      if (p.label * (w1 * p.x + w2 * p.y + b) < 1) {
        g1 -= (p.label * p.x) / data.length;
        g2 -= (p.label * p.y) / data.length;
        gb -= p.label / data.length;
      }
    }
    w1 -= rate * g1;
    w2 -= rate * g2;
    b -= rate * gb;
  }
  return { w1, w2, b };
}

export function Margin() {
  const [power, setPower] = useState(0); // C = 10^power
  const c = 10 ** power;
  const model = useMemo(() => trainSvm(TWO_GROUPS, c), [c]);
  const score = (p: Pt) => p.label * (model.w1 * p.x + model.w2 * p.y + model.b);
  const inside = TWO_GROUPS.filter((p) => score(p) < 0.999).length;
  const wrong = TWO_GROUPS.filter((p) => score(p) < 0).length;
  const width = 2 / Math.hypot(model.w1, model.w2);

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-4, 4], [-3.5, 3.5], { x: "feature 1", y: "feature 2" });
    line(ctx, p, model.w1, model.w2, model.b - 1, "#888", [5, 5]);
    line(ctx, p, model.w1, model.w2, model.b + 1, "#888", [5, 5]);
    line(ctx, p, model.w1, model.w2, model.b);
    for (const d of TWO_GROUPS) {
      square(ctx, p.px(d.x), p.py(d.y), 7, d.label === 1 ? POS : NEG);
      if (score(d) < 1.001) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.strokeRect(p.px(d.x) - 7, p.py(d.y) - 7, 14, 14);
      }
    }
  }, [model]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Strictness C" value={power} min={-2.5} max={2} step={0.1} onChange={setPower} format={() => c.toPrecision(2)} />
          <Readout label="Street width" value={width.toFixed(2)} />
          <Readout label="Points on the street" value={String(inside)} />
          <Readout label="Misclassified" value={String(wrong)} tone={wrong === 0 ? "pos" : "neg"} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Linear SVM boundary, its margins and support vectors" />
      <p className="label pointer-events-none absolute right-4 top-3">solid = boundary · dashed = edges of the street · boxed = support vectors</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. lifting into 3D
const RINGS = (() => {
  const r = rng(13);
  const ring = (lo: number, hi: number, n: number, inner: boolean) =>
    Array.from({ length: n }, () => {
      const radius = lo + r.next() * (hi - lo);
      const angle = r.next() * Math.PI * 2;
      return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, inner };
    });
  return [...ring(0, 0.8, 30, true), ...ring(1.4, 2, 44, false)];
})();
const LIFT = 0.6;

export function KernelLift() {
  const [lift, setLift] = useState(0);
  const cut = lift * LIFT * 1.2;
  const grid = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(4.6, 4.6, 6, 6)), []);
  const separable = lift > 0.15;

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Lift by distance from centre (x² + y²)" value={lift} min={0} max={1} step={0.01} onChange={setLift} format={(v) => `${Math.round(v * 100)}%`} />
          <Readout label="One flat cut separates them" value={separable ? "Yes" : "No"} tone={separable ? "pos" : "neg"} />
        </>
      }
    >
      <Stage3D camera={[4.5, 3.2, 5.5]}>
        <group position={[0, -0.9, 0]}>
          <lineSegments geometry={grid} rotation={[-Math.PI / 2, 0, 0]}>
            <lineBasicMaterial color="#333333" />
          </lineSegments>
          {separable && (
            <lineSegments geometry={grid} rotation={[-Math.PI / 2, 0, 0]} position={[0, cut, 0]}>
              <lineBasicMaterial color="#ffffff" />
            </lineSegments>
          )}
          {RINGS.map((p, i) => (
            <mesh key={i} position={[p.x, lift * LIFT * (p.x * p.x + p.z * p.z), p.z]}>
              <boxGeometry args={[0.11, 0.11, 0.11]} />
              <meshBasicMaterial color={p.inner ? POS : NEG} />
            </mesh>
          ))}
        </group>
      </Stage3D>
      <p className="label pointer-events-none absolute bottom-2 left-3">Drag to rotate · look from the side once lifted</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. gamma
function moons(n: number, seed: number): Pt[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI * r.next();
    const top = i % 2 === 0;
    return {
      x: (top ? Math.cos(a) : 1 - Math.cos(a)) + r.normal() * 0.2 - 0.5,
      y: (top ? Math.sin(a) : 0.5 - Math.sin(a)) + r.normal() * 0.2 - 0.25,
      label: top ? 1 : -1,
    };
  });
}
const MOON_TRAIN = moons(70, 31);
const MOON_TEST = moons(120, 77);

const vote = (x: number, y: number, gamma: number, skip?: Pt) => {
  let total = 0;
  for (const p of MOON_TRAIN) if (p !== skip) total += p.label * Math.exp(-gamma * ((x - p.x) ** 2 + (y - p.y) ** 2));
  return total;
};

export function Gamma() {
  const [power, setPower] = useState(0.5); // gamma = 10^power
  const gamma = 10 ** power;
  const accuracy = (points: Pt[]) => points.filter((p) => Math.sign(vote(p.x, p.y, gamma)) === p.label).length / points.length;
  const train = accuracy(MOON_TRAIN);
  const test = accuracy(MOON_TEST);

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-2.2, 2.2], [-1.8, 1.8], { x: "feature 1", y: "feature 2" });
    dotMap(ctx, p, (x, y) => {
      const v = vote(x, y, gamma);
      const strength = Math.min(1, Math.abs(v) * 1.5);
      return { size: 0.15 + 0.5 * strength, color: (v >= 0 ? POS : NEG) + "70" };
    });
    for (const d of MOON_TRAIN) square(ctx, p.px(d.x), p.py(d.y), 7, d.label === 1 ? POS : NEG);
  }, [gamma]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Gamma γ (reach of each point)" value={power} min={-1} max={2.7} step={0.05} onChange={setPower} format={() => gamma.toPrecision(2)} />
          <Readout label="Accuracy on training points" value={`${(train * 100).toFixed(0)}%`} />
          <Readout label="Accuracy on new points" value={`${(test * 100).toFixed(0)}%`} tone={test > 0.93 ? "pos" : test < 0.88 ? "neg" : undefined} />
          <span className="max-w-xs text-sm text-dim">Simplified: here every training point votes. A real SVM keeps only its support vectors.</span>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Decision regions of an RBF kernel classifier" />
    </Frame>
  );
}

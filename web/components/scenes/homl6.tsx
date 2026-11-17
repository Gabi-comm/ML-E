"use client";

import { useMemo, useState } from "react";
import { CLASS_COLORS, DIM, Frame, NEG, POS, Readout, Slider, curve, dotMap, plot, rng, square, useCanvas, type Plot } from "./ui";

export type Pt = { x: number; y: number; label: number };
export type Node =
  | { leaf: true; label: number; count: number }
  | { leaf: false; feature: "x" | "y"; threshold: number; left: Node; right: Node; label: number };

// ---------------------------------------------------------------- CART
function gini(points: Pt[], classes: number) {
  if (!points.length) return 0;
  let sum = 0;
  for (let k = 0; k < classes; k++) {
    const share = points.filter((p) => p.label === k).length / points.length;
    sum += share * share;
  }
  return 1 - sum;
}

function majority(points: Pt[], classes: number) {
  let best = 0, bestCount = -1;
  for (let k = 0; k < classes; k++) {
    const n = points.filter((p) => p.label === k).length;
    if (n > bestCount) { best = k; bestCount = n; }
  }
  return best;
}

export function grow(points: Pt[], classes: number, depth: number, maxDepth: number, minLeaf: number): Node {
  const label = majority(points, classes);
  if (depth >= maxDepth || gini(points, classes) === 0) return { leaf: true, label, count: points.length };
  let best: { feature: "x" | "y"; threshold: number; score: number } | null = null;
  for (const feature of ["x", "y"] as const) {
    const values = [...new Set(points.map((p) => p[feature]))].sort((a, b) => a - b);
    for (let i = 1; i < values.length; i++) {
      const threshold = (values[i - 1] + values[i]) / 2;
      const left = points.filter((p) => p[feature] <= threshold);
      const right = points.filter((p) => p[feature] > threshold);
      if (left.length < minLeaf || right.length < minLeaf) continue;
      const score = (left.length * gini(left, classes) + right.length * gini(right, classes)) / points.length;
      if (!best || score < best.score - 1e-12) best = { feature, threshold, score };
    }
  }
  if (!best) return { leaf: true, label, count: points.length };
  const { feature, threshold } = best;
  return {
    leaf: false, feature, threshold, label,
    left: grow(points.filter((p) => p[feature] <= threshold), classes, depth + 1, maxDepth, minLeaf),
    right: grow(points.filter((p) => p[feature] > threshold), classes, depth + 1, maxDepth, minLeaf),
  };
}

export const predict = (node: Node, x: number, y: number): number =>
  node.leaf ? node.label : predict((node.feature === "x" ? x : y) <= node.threshold ? node.left : node.right, x, y);
const leaves = (node: Node): number => (node.leaf ? 1 : leaves(node.left) + leaves(node.right));
const height = (node: Node): number => (node.leaf ? 0 : 1 + Math.max(height(node.left), height(node.right)));

function drawRegions(ctx: CanvasRenderingContext2D, p: Plot, tree: Node, points: Pt[]) {
  dotMap(ctx, p, (x, y) => ({ size: 0.3, color: CLASS_COLORS[predict(tree, x, y)] + "55" }));
  for (const d of points) square(ctx, p.px(d.x), p.py(d.y), 6, CLASS_COLORS[d.label]);
}

/** Tree diagram: each split is a white box, each leaf a box in its class colour. */
function drawTree(ctx: CanvasRenderingContext2D, tree: Node, left: number, top: number, width: number, heightPx: number) {
  const total = leaves(tree);
  const levels = Math.max(1, height(tree));
  let cursor = 0;
  const place = (node: Node, depth: number): number => {
    const y = top + 14 + (depth / levels) * (heightPx - 28);
    if (node.leaf) {
      const x = left + ((cursor + 0.5) / total) * width;
      cursor += 1;
      square(ctx, x, y, Math.max(4, Math.min(12, width / total - 2)), CLASS_COLORS[node.label]);
      return x;
    }
    const childY = top + 14 + ((depth + 1) / levels) * (heightPx - 28);
    const a = place(node.left, depth + 1);
    const b = place(node.right, depth + 1);
    const x = (a + b) / 2;
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a, childY); ctx.lineTo(x, y); ctx.lineTo(b, childY);
    ctx.stroke();
    square(ctx, x, y, 9, "#fff");
    if (total <= 10) {
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillStyle = DIM;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${node.feature === "x" ? "x₁" : "x₂"} ≤ ${node.threshold.toFixed(1)}`, x, y - 7);
    }
    return x;
  };
  place(tree, 0);
}

// ---------------------------------------------------------------- 1. impurity
export function Impurity() {
  const [count, setCount] = useState(10);
  const p = count / 20;
  const giniOf = (q: number) => 1 - q * q - (1 - q) * (1 - q);
  const entropyOf = (q: number) => (q <= 0 || q >= 1 ? 0 : -(q * Math.log2(q) + (1 - q) * Math.log2(1 - q)));

  const ref = useCanvas((ctx, w, h) => {
    const pl = plot(ctx, w, h, [0, 1], [0, 1], { x: "share of green in the box", y: "impurity" });
    curve(ctx, pl, entropyOf, DIM, 1.5);
    curve(ctx, pl, giniOf);
    square(ctx, pl.px(p), pl.py(giniOf(p)), 11, POS);
    square(ctx, pl.px(p), pl.py(entropyOf(p)), 9, DIM);
  }, [p]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Green items in the box (of 20)" value={count} min={0} max={20} step={1} onChange={setCount} />
          <Readout label="Gini impurity" value={giniOf(p).toFixed(3)} tone={giniOf(p) === 0 ? "pos" : undefined} />
          <Readout label="Entropy" value={entropyOf(p).toFixed(3)} />
        </>
      }
    >
      <div className="flex h-full flex-col sm:flex-row">
        <div className="grid shrink-0 grid-cols-10 content-center gap-1.5 p-5 sm:w-64 sm:grid-cols-5">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className="aspect-square" style={{ background: i < count ? POS : NEG }} />
          ))}
        </div>
        <canvas ref={ref} className="min-h-0 min-w-0 flex-1" role="img" aria-label="Gini impurity and entropy as the class mix changes" />
      </div>
      <p className="label pointer-events-none absolute right-4 top-3">white = Gini · grey = entropy</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. grow a tree
function blobs(n: number, seed: number): Pt[] {
  const r = rng(seed);
  const centres = [[-1.3, 1.0], [1.4, 1.1], [0.1, -1.2]];
  return Array.from({ length: n }, (_, i) => {
    const label = i % 3;
    return { x: centres[label][0] + r.normal() * 0.95, y: centres[label][1] + r.normal() * 0.95, label };
  });
}
const TREE_TRAIN = blobs(90, 6);
const TREE_TEST = blobs(240, 60);

export function TreeGrow() {
  const [depth, setDepth] = useState(1);
  const [minLeaf, setMinLeaf] = useState(1);
  const tree = useMemo(() => grow(TREE_TRAIN, 3, 0, depth, minLeaf), [depth, minLeaf]);
  const accuracy = (points: Pt[]) => points.filter((p) => predict(tree, p.x, p.y) === p.label).length / points.length;
  const train = accuracy(TREE_TRAIN);
  const test = accuracy(TREE_TEST);

  const ref = useCanvas((ctx, w, h) => {
    const split = w * 0.58;
    const p = plot(ctx, split, h, [-4, 4], [-3.5, 3.5], { x: "x₁", y: "x₂" });
    drawRegions(ctx, p, tree, TREE_TRAIN);
    drawTree(ctx, tree, split + 12, 6, w - split - 24, h - 30);
  }, [tree]);

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Maximum depth" value={depth} min={0} max={9} step={1} onChange={setDepth} />
          <Slider label="Smallest allowed leaf" value={minLeaf} min={1} max={20} step={1} onChange={setMinLeaf} />
          <Readout label="Leaves" value={String(leaves(tree))} />
          <Readout label="Training accuracy" value={`${(train * 100).toFixed(0)}%`} />
          <Readout label="New-data accuracy" value={`${(test * 100).toFixed(0)}%`} tone={train - test > 0.12 ? "neg" : test > 0.8 ? "pos" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Decision tree regions next to the tree diagram" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. rotation
const STRIPE: Pt[] = (() => {
  const r = rng(40);
  return Array.from({ length: 110 }, () => {
    const x = r.next() * 5 - 2.5;
    const y = r.next() * 5 - 2.5;
    return { x, y, label: x > 0 ? 0 : 1 };
  }).filter((p) => Math.abs(p.x) > 0.12);
})();

export function TreeRotate() {
  const [angle, setAngle] = useState(0);
  const data = useMemo(() => {
    const a = (angle * Math.PI) / 180;
    return STRIPE.map((p) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a), label: p.label }));
  }, [angle]);
  const tree = useMemo(() => grow(data, 2, 0, 9, 1), [data]);

  const ref = useCanvas((ctx, w, h) => {
    const split = w * 0.58;
    const p = plot(ctx, split, h, [-4, 4], [-4, 4], { x: "x₁", y: "x₂" });
    drawRegions(ctx, p, tree, data);
    drawTree(ctx, tree, split + 12, 6, w - split - 24, h - 30);
  }, [tree, data]);

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Rotate the same data" value={angle} min={0} max={90} step={1} onChange={setAngle} format={(v) => `${v}°`} />
          <Readout label="Splits needed" value={String(leaves(tree) - 1)} tone={leaves(tree) <= 2 ? "pos" : "neg"} />
          <span className="max-w-sm text-sm text-dim">The two groups are always separated by one straight line. Only its direction changes.</span>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Decision tree boundary on rotated data" />
    </Frame>
  );
}

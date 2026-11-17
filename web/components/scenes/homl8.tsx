"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Choice, Frame, NEG, POS, Readout, Slider, Stage3D, plot, rng, square, useCanvas } from "./ui";

// ---------------------------------------------------------------- 1. curse of dimensionality
const AVERAGE_DISTANCE = (() => {
  const r = rng(88);
  return Array.from({ length: 100 }, (_, i) => {
    const d = i + 1;
    let total = 0;
    for (let pair = 0; pair < 160; pair++) {
      let sum = 0;
      for (let k = 0; k < d; k++) sum += (r.next() - r.next()) ** 2;
      total += Math.sqrt(sum);
    }
    return total / 160;
  });
})();

export function Curse() {
  const [dims, setDims] = useState(2);
  const distance = AVERAGE_DISTANCE[dims - 1];
  const edge = 1 - Math.pow(0.9, dims); // share of a unit cube within 5% of some face
  const needed = Math.pow(10, dims); // points for 10 per axis

  const ref = useCanvas((ctx, w, h) => {
    const half = w / 2;
    const a = plot(ctx, half, h, [1, 100], [0, 5], { x: "dimensions", y: "distance" });
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    AVERAGE_DISTANCE.forEach((v, i) => (i ? ctx.lineTo(a.px(i + 1), a.py(v)) : ctx.moveTo(a.px(1), a.py(v))));
    ctx.stroke();
    square(ctx, a.px(dims), a.py(distance), 11, POS);
    ctx.save();
    ctx.translate(half, 0);
    const b = plot(ctx, half, h, [1, 100], [0, 1], { x: "dimensions", y: "share near an edge" });
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    for (let d = 1; d <= 100; d++) {
      const v = 1 - Math.pow(0.9, d);
      if (d === 1) ctx.moveTo(b.px(d), b.py(v));
      else ctx.lineTo(b.px(d), b.py(v));
    }
    ctx.stroke();
    square(ctx, b.px(dims), b.py(edge), 11, POS);
    ctx.restore();
  }, [dims]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Number of features (dimensions)" value={dims} min={1} max={100} step={1} onChange={setDims} />
          <Readout label="Typical distance between two points" value={distance.toFixed(2)} />
          <Readout label="Points sitting near an edge" value={`${(edge * 100).toFixed(0)}%`} tone={edge > 0.9 ? "neg" : undefined} />
          <Readout label="Points to cover it 10 per axis" value={dims <= 6 ? needed.toLocaleString() : `10^${dims}`} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Average distance and share of points near an edge as dimensions grow" />
      <p className="label pointer-events-none absolute left-14 top-3">How far apart random points are</p>
      <p className="label pointer-events-none absolute left-[calc(50%+3.5rem)] top-3">How many sit within 5% of an edge</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. PCA in 3D
type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scaleV = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a: V3): V3 => scaleV(a, 1 / (Math.hypot(...a) || 1));

const CLOUD: V3[] = (() => {
  const r = rng(61);
  const u: V3 = unit([1, 0.45, 0.3]);
  const v: V3 = unit(sub([0.2, 1, -0.5], scaleV(u, dot([0.2, 1, -0.5], u))));
  const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return Array.from({ length: 140 }, () => {
    const a = r.normal() * 1.5, b = r.normal() * 0.7, c = r.normal() * 0.18;
    return [a * u[0] + b * v[0] + c * n[0], a * u[1] + b * v[1] + c * n[1], a * u[2] + b * v[2] + c * n[2]] as V3;
  });
})();

/** Principal components by power iteration on the covariance matrix. */
const PCA = (() => {
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of CLOUD) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += (p[i] * p[j]) / CLOUD.length;
  const axes: V3[] = [];
  const variances: number[] = [];
  for (let c = 0; c < 3; c++) {
    let v: V3 = unit([1, 0.7, 0.4]);
    for (let it = 0; it < 200; it++) {
      let next: V3 = [dot(cov[0] as V3, v), dot(cov[1] as V3, v), dot(cov[2] as V3, v)];
      for (const prev of axes) next = sub(next, scaleV(prev, dot(next, prev)));
      v = unit(next);
    }
    axes.push(v);
    variances.push(dot(v, [dot(cov[0] as V3, v), dot(cov[1] as V3, v), dot(cov[2] as V3, v)]));
  }
  const total = variances.reduce((a, b) => a + b, 0);
  return { axes, ratio: variances.map((x) => x / total), sd: variances.map(Math.sqrt) };
})();

function Axis({ direction, length, color }: { direction: V3; length: number; color: string }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints([new THREE.Vector3(...scaleV(direction, -length)), new THREE.Vector3(...scaleV(direction, length))]);
    return g;
  }, [direction, length]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}

function Cloud({ positions, colors, size = 0.09 }: { positions: Float32Array; colors?: Float32Array; size?: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    if (colors) g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial size={size} vertexColors={!!colors} color={colors ? "#ffffff" : "#ffffff"} sizeAttenuation />
    </points>
  );
}

export function Pca3D() {
  const [flatten, setFlatten] = useState(0);
  const positions = useMemo(() => {
    const out = new Float32Array(CLOUD.length * 3);
    CLOUD.forEach((p, i) => {
      const q = sub(p, scaleV(PCA.axes[2], dot(p, PCA.axes[2]) * flatten));
      out.set(q, i * 3);
    });
    return out;
  }, [flatten]);
  const kept = PCA.ratio[0] + PCA.ratio[1];

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Flatten onto the best 2D plane" value={flatten} min={0} max={1} step={0.01} onChange={setFlatten} format={(v) => `${Math.round(v * 100)}%`} />
          <Readout label="1st direction holds" value={`${(PCA.ratio[0] * 100).toFixed(0)}%`} />
          <Readout label="2nd" value={`${(PCA.ratio[1] * 100).toFixed(0)}%`} />
          <Readout label="3rd" value={`${(PCA.ratio[2] * 100).toFixed(1)}%`} tone="neg" />
          <Readout label="Kept in 2D" value={`${(kept * 100).toFixed(1)}%`} tone="pos" />
        </>
      }
    >
      <Stage3D camera={[4, 3, 5.5]}>
        <Cloud positions={positions} />
        <Axis direction={PCA.axes[0]} length={PCA.sd[0] * 2.4} color="#ffffff" />
        <Axis direction={PCA.axes[1]} length={PCA.sd[1] * 2.4} color={POS} />
        <Axis direction={PCA.axes[2]} length={Math.max(0.6, PCA.sd[2] * 2.4)} color={NEG} />
      </Stage3D>
      <p className="label pointer-events-none absolute bottom-2 left-3">white, green = directions kept · red = direction dropped · drag to rotate</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. swiss roll
const ROLL = (() => {
  const r = rng(5);
  return Array.from({ length: 700 }, () => ({ t: 1.5 * Math.PI + r.next() * 3 * Math.PI, h: r.next() * 3 - 1.5 }));
})();
const ROLL_COLORS = (() => {
  const out = new Float32Array(ROLL.length * 3);
  const a = new THREE.Color(POS), b = new THREE.Color("#ffffff"), c = new THREE.Color(NEG), mix = new THREE.Color();
  ROLL.forEach((p, i) => {
    const u = (p.t - 1.5 * Math.PI) / (3 * Math.PI);
    if (u < 0.5) mix.copy(a).lerp(b, u * 2);
    else mix.copy(b).lerp(c, (u - 0.5) * 2);
    out.set([mix.r, mix.g, mix.b], i * 3);
  });
  return out;
})();

export function SwissRoll() {
  const [method, setMethod] = useState<"unroll it" | "squash it flat">("unroll it");
  const [amount, setAmount] = useState(0);
  const positions = useMemo(() => {
    const out = new Float32Array(ROLL.length * 3);
    ROLL.forEach((p, i) => {
      const x = 0.22 * p.t * Math.cos(p.t), z = 0.22 * p.t * Math.sin(p.t);
      if (method === "unroll it") {
        const flatX = (p.t - 3 * Math.PI) * 0.6;
        out.set([x + (flatX - x) * amount, p.h, z * (1 - amount)], i * 3);
      } else {
        out.set([x, p.h, z * (1 - amount)], i * 3);
      }
    });
    return out;
  }, [method, amount]);
  const done = amount > 0.95;

  return (
    <Frame
      tall
      controls={
        <>
          <Choice label="Reduce 3D to 2D by" value={method} options={["unroll it", "squash it flat"] as const} onChange={(m) => { setMethod(m); setAmount(0); }} />
          <Slider label="Amount" value={amount} min={0} max={1} step={0.01} onChange={setAmount} format={(v) => `${Math.round(v * 100)}%`} />
          <Readout
            label="Colours after flattening"
            value={!done ? "–" : method === "unroll it" ? "Still in order" : "Mixed together"}
            tone={!done ? undefined : method === "unroll it" ? "pos" : "neg"}
          />
        </>
      }
    >
      <Stage3D camera={[0, 2.5, 8]}>
        <Cloud positions={positions} colors={ROLL_COLORS} size={0.1} />
      </Stage3D>
      <p className="label pointer-events-none absolute bottom-2 left-3">Colour = position along the rolled sheet · drag to rotate</p>
    </Frame>
  );
}

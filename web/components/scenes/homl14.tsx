"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Choice, Frame, NEG, POS, Readout, Slider, Stage3D } from "./ui";

/** A square grid of cells; `shade` returns a CSS colour per cell. */
function Grid({
  size, cell = 16, shade, outline, label,
}: { size: number; cell?: number; shade: (r: number, c: number) => string; outline?: (r: number, c: number) => string | null; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)` }} role="img" aria-label={label}>
        {Array.from({ length: size * size }, (_, i) => {
          const r = Math.floor(i / size), c = i % size;
          const ring = outline?.(r, c);
          return <span key={i} style={{ width: cell, height: cell, background: shade(r, c), outline: ring ? `2px solid ${ring}` : undefined, outlineOffset: -1 }} />;
        })}
      </div>
      {label && <span className="label">{label}</span>}
    </div>
  );
}

const grey = (v: number) => {
  const s = Math.round(18 + Math.max(0, Math.min(1, v)) * 237);
  return `rgb(${s},${s},${s})`;
};
const signed = (v: number, peak: number) => {
  const a = Math.min(1, Math.abs(v) / (peak || 1));
  return v >= 0 ? `rgba(255,255,255,${0.06 + 0.94 * a})` : `rgba(255,92,122,${0.06 + 0.94 * a})`;
};

// ---------------------------------------------------------------- 1. a filter sliding over an image
const IMAGE = Array.from({ length: 12 }, (_, r) =>
  Array.from({ length: 12 }, (_, c) => {
    const frame = r >= 2 && r <= 9 && c >= 2 && c <= 9 && (r === 2 || r === 9 || c === 2 || c === 9);
    const diagonal = r === c && r >= 2 && r <= 9;
    return frame || diagonal ? 1 : 0;
  }),
);
const KERNELS = {
  "vertical edges": [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]],
  "horizontal edges": [[-1, -1, -1], [0, 0, 0], [1, 1, 1]],
  blur: [[1, 1, 1], [1, 1, 1], [1, 1, 1]].map((row) => row.map((v) => v / 9)),
  sharpen: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
} as const;

export function Convolution() {
  const [name, setName] = useState<keyof typeof KERNELS>("vertical edges");
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const kernel = KERNELS[name];
  const out = useMemo(
    () => Array.from({ length: 10 }, (_, r) => Array.from({ length: 10 }, (_, c) => {
      let sum = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) sum += IMAGE[r + i][c + j] * kernel[i][j];
      return sum;
    })),
    [kernel],
  );
  const peak = Math.max(...out.flat().map(Math.abs));
  const row = Math.floor(position / 10), col = position % 10;

  useEffect(() => {
    if (!playing) return;
    let p = position >= 99 ? 0 : position;
    const timer = setInterval(() => {
      p += 1;
      setPosition(p);
      if (p >= 99) {
        clearInterval(timer);
        setPlaying(false);
      }
    }, 70);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Filter" value={name} options={["vertical edges", "horizontal edges", "blur", "sharpen"] as const} onChange={setName} />
          <Slider label="Filter position" value={position} min={0} max={99} step={1} onChange={setPosition} format={(v) => `${v + 1} / 100`} />
          <button className="btn btn-solid" onClick={() => setPlaying((p) => !p)}>{playing ? "■ Pause" : "▶ Slide it"}</button>
          <Readout label="Output at this spot" value={out[row][col].toFixed(2)} />
        </>
      }
    >
      <div className="flex h-full flex-wrap items-center justify-center gap-x-8 gap-y-3 p-3">
        <Grid size={12} shade={(r, c) => grey(IMAGE[r][c])} outline={(r, c) => (r >= row && r < row + 3 && c >= col && c < col + 3 ? POS : null)} label="Input image 12×12" />
        <div className="flex flex-col items-center gap-1">
          <div className="grid grid-cols-3 gap-px">
            {kernel.flat().map((v, i) => (
              <span key={i} className="grid h-9 w-9 place-items-center border border-line font-mono text-[11px]" style={{ color: v < 0 ? NEG : v > 0 ? "#fff" : "#5a5a5a" }}>
                {Number.isInteger(v) ? v : v.toFixed(2)}
              </span>
            ))}
          </div>
          <span className="label">Filter 3×3</span>
        </div>
        <Grid size={10} shade={(r, c) => (r * 10 + c <= position ? signed(out[r][c], peak) : "#0c0c0c")} outline={(r, c) => (r === row && c === col ? POS : null)} label="Feature map 10×10" />
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. stride and padding
export function StridePadding() {
  const [kernel, setKernel] = useState<"3" | "5">("3");
  const [stride, setStride] = useState(1);
  const [padding, setPadding] = useState(0);
  const [index, setIndex] = useState(0);
  const n = 7, k = Number(kernel);
  const padded = n + 2 * padding;
  const outSize = Math.max(0, Math.floor((padded - k) / stride) + 1);
  const count = outSize * outSize;
  const current = Math.min(index, Math.max(0, count - 1));
  const r0 = Math.floor(current / (outSize || 1)) * stride, c0 = (current % (outSize || 1)) * stride;

  return (
    <Frame
      controls={
        <>
          <Choice label="Filter size" value={kernel} options={["3", "5"] as const} onChange={setKernel} />
          <Slider label="Stride (step size)" value={stride} min={1} max={3} step={1} onChange={setStride} />
          <Slider label="Padding (border of zeros)" value={padding} min={0} max={2} step={1} onChange={setPadding} />
          <Slider label="Show window" value={current} min={0} max={Math.max(0, count - 1)} step={1} onChange={setIndex} format={(v) => `${v + 1} / ${count}`} />
          <Readout label="Output size" value={`${outSize} × ${outSize}`} tone={outSize === n ? "pos" : undefined} />
        </>
      }
    >
      <div className="flex h-full flex-wrap items-center justify-center gap-x-10 gap-y-3 p-3">
        <Grid
          size={padded}
          cell={Math.floor(200 / padded)}
          shade={(r, c) => (r < padding || c < padding || r >= padded - padding || c >= padded - padding ? "#0a0a0a" : "#3a3a3a")}
          outline={(r, c) => (count > 0 && r >= r0 && r < r0 + k && c >= c0 && c < c0 + k ? POS : null)}
          label={`Input 7×7${padding ? ` + ${padding} of padding` : ""}`}
        />
        <div className="font-mono text-sm text-dim">
          <p>size = (input + 2 × padding − filter) ÷ stride + 1</p>
          <p className="mt-1 text-white">= ({n} + {2 * padding} − {k}) ÷ {stride} + 1 = {outSize}</p>
        </div>
        {outSize > 0 && (
          <Grid size={outSize} cell={Math.floor(200 / Math.max(outSize, 5))} shade={(r, c) => (r * outSize + c === current ? POS : "#3a3a3a")} label={`Output ${outSize}×${outSize}`} />
        )}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. pooling
const FEATURE = (shift: number) =>
  Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 8 }, (_, c) => {
      const cc = c - shift;
      const blob = Math.exp(-((r - 2.5) ** 2 + (cc - 2.5) ** 2) / 2.2);
      const bar = r >= 5 && r <= 6 && cc >= 3 && cc <= 6 ? 0.8 : 0;
      return Math.min(1, blob + bar);
    }),
  );
const pool = (map: number[][], mode: "max" | "average") =>
  Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => {
    const cells = [map[2 * r][2 * c], map[2 * r][2 * c + 1], map[2 * r + 1][2 * c], map[2 * r + 1][2 * c + 1]];
    return mode === "max" ? Math.max(...cells) : cells.reduce((a, b) => a + b, 0) / 4;
  }));

export function Pooling() {
  const [mode, setMode] = useState<"max" | "average">("max");
  const map = useMemo(() => FEATURE(0), []);
  const pooled = pool(map, mode);
  const before = Math.max(...map.flat());
  const after = Math.max(...pooled.flat());

  return (
    <Frame
      controls={
        <>
          <Choice label="Pooling" value={mode} options={["max", "average"] as const} onChange={setMode} />
          <Readout label="Numbers kept" value="16 of 64" />
          <Readout label="Strongest signal before" value={before.toFixed(2)} />
          <Readout label="Strongest signal after" value={after.toFixed(2)} tone={after >= before - 0.005 ? "pos" : "neg"} />
        </>
      }
    >
      <div className="flex h-full flex-wrap items-center justify-center gap-x-12 gap-y-3 p-3">
        <Grid size={8} cell={26} shade={(r, c) => grey(map[r][c])} label="Feature map 8×8" />
        <span className="font-mono text-2xl text-dim" aria-hidden>▸</span>
        <Grid size={4} cell={52} shade={(r, c) => grey(pooled[r][c])} label={`After 2×2 ${mode} pooling: 4×4`} />
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. the whole network as volumes
type Vol = { name: string; h: number; w: number; c: number; params: number };
const ARCHITECTURES: Record<"small (LeNet style)" | "deeper", Vol[]> = {
  "small (LeNet style)": [
    { name: "Input", h: 28, w: 28, c: 1, params: 0 },
    { name: "Conv 5×5, 6 filters", h: 28, w: 28, c: 6, params: 5 * 5 * 1 * 6 + 6 },
    { name: "Pool", h: 14, w: 14, c: 6, params: 0 },
    { name: "Conv 5×5, 16 filters", h: 10, w: 10, c: 16, params: 5 * 5 * 6 * 16 + 16 },
    { name: "Pool", h: 5, w: 5, c: 16, params: 0 },
    { name: "Flatten", h: 400, w: 1, c: 1, params: 0 },
    { name: "Dense 120", h: 120, w: 1, c: 1, params: 400 * 120 + 120 },
    { name: "Dense 84", h: 84, w: 1, c: 1, params: 120 * 84 + 84 },
    { name: "Output 10", h: 10, w: 1, c: 1, params: 84 * 10 + 10 },
  ],
  deeper: [
    { name: "Input", h: 28, w: 28, c: 1, params: 0 },
    { name: "Conv 3×3, 32 filters", h: 28, w: 28, c: 32, params: 3 * 3 * 1 * 32 + 32 },
    { name: "Conv 3×3, 32 filters", h: 28, w: 28, c: 32, params: 3 * 3 * 32 * 32 + 32 },
    { name: "Pool", h: 14, w: 14, c: 32, params: 0 },
    { name: "Conv 3×3, 64 filters", h: 14, w: 14, c: 64, params: 3 * 3 * 32 * 64 + 64 },
    { name: "Conv 3×3, 64 filters", h: 14, w: 14, c: 64, params: 3 * 3 * 64 * 64 + 64 },
    { name: "Pool", h: 7, w: 7, c: 64, params: 0 },
    { name: "Flatten", h: 3136, w: 1, c: 1, params: 0 },
    { name: "Dense 128", h: 128, w: 1, c: 1, params: 3136 * 128 + 128 },
    { name: "Output 10", h: 10, w: 1, c: 1, params: 128 * 10 + 10 },
  ],
};

function Volume({ vol, x, active }: { vol: Vol; x: number; active: boolean }) {
  const flat = vol.w === 1;
  const size: [number, number, number] = flat
    ? [0.12, 0.35 + Math.log10(vol.h) * 0.55, 0.12]
    : [0.1 + Math.log2(vol.c + 1) * 0.16, (vol.h / 28) * 2.2, (vol.w / 28) * 2.2];
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size[0], size[1], size[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={[x, 0, 0]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={active ? "#7cffb2" : "#9a9a9a"} />
      </lineSegments>
      {active && (
        <mesh>
          <boxGeometry args={size} />
          <meshBasicMaterial color="#7cffb2" transparent opacity={0.18} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

export function Volumes() {
  const [name, setName] = useState<keyof typeof ARCHITECTURES>("small (LeNet style)");
  const [index, setIndex] = useState(1);
  const layers = ARCHITECTURES[name];
  const current = Math.min(index, layers.length - 1);
  const layer = layers[current];
  const total = layers.reduce((s, l) => s + l.params, 0);
  const spacing = 1.25;

  return (
    <Frame
      tall
      controls={
        <>
          <Choice label="Network" value={name} options={["small (LeNet style)", "deeper"] as const} onChange={setName} />
          <Slider label="Layer" value={current} min={0} max={layers.length - 1} step={1} onChange={setIndex} format={() => layer.name} />
          <Readout label="Shape here" value={layer.w === 1 ? `${layer.h.toLocaleString()}` : `${layer.h}×${layer.w}×${layer.c}`} tone="pos" />
          <Readout label="Weights in this layer" value={layer.params.toLocaleString()} />
          <Readout label="Whole network" value={total.toLocaleString()} />
        </>
      }
    >
      <Stage3D camera={[-3.5, 3, 9.5]}>
        <group position={[-((layers.length - 1) * spacing) / 2, 0, 0]}>
          {layers.map((vol, i) => <Volume key={`${name}-${i}`} vol={vol} x={i * spacing} active={i === current} />)}
        </group>
      </Stage3D>
      <p className="label pointer-events-none absolute bottom-2 left-3">Height × width shrink, depth (number of feature maps) grows · drag to rotate</p>
    </Frame>
  );
}

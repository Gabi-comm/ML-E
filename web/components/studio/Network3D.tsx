"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Layer } from "@/lib/engine";

export const MAX_NODES = 16; // must match mle.MAX_NODES on the Python side
const GAP = 3.2; // distance between layers
const SPACING = 0.5; // distance between nodes

type Placed = {
  layer: Layer;
  index: number; // index in the original layer list
  x: number;
  sized: boolean;
  real: number | null; // real number of units
  nodes: THREE.Vector3[];
};

function nodeGrid(count: number, x: number): THREE.Vector3[] {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return new THREE.Vector3(x, ((rows - 1) / 2 - row) * SPACING, (col - (cols - 1) / 2) * SPACING);
  });
}

function place(layers: Layer[]): Placed[] {
  const start = -((layers.length - 1) * GAP) / 2;
  return layers.map((layer, index) => {
    const x = start + index * GAP;
    const sized = typeof layer.units === "number" && layer.units > 0;
    const drawn = sized ? Math.min(layer.units as number, MAX_NODES) : 0;
    return { layer, index, x, sized, real: layer.units, nodes: nodeGrid(drawn, x) };
  });
}

const POS = new THREE.Color("#7cffb2");
const NEG = new THREE.Color("#ff5c7a");

function Nodes({ placed, active, training }: { placed: Placed; active: boolean; training: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placed.nodes.forEach((p, i) => {
      dummy.position.copy(p);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [placed, dummy]);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh || !training) return;
    const t = clock.elapsedTime;
    placed.nodes.forEach((p, i) => {
      dummy.position.copy(p);
      // a wave travelling from input to output while training
      dummy.scale.setScalar(1 + 0.35 * Math.max(0, Math.sin(t * 5 - placed.x * 0.9 + i * 0.4)));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (placed.nodes.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, placed.nodes.length]} key={placed.nodes.length}>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshBasicMaterial color={active ? "#ffffff" : "#d0d0d0"} />
    </instancedMesh>
  );
}

function Plate({ x, active }: { x: number; active: boolean }) {
  // layers with no size of their own (Flatten, Dropout, activations) are drawn as a frame
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.6, 1.6)), []);
  return (
    <lineSegments geometry={geometry} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <lineBasicMaterial color={active ? "#ffffff" : "#555555"} />
    </lineSegments>
  );
}

function Connections({ from, to, weights }: { from: Placed; to: Placed; weights?: number[][] }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    let peak = 0;
    if (weights) for (const row of weights) for (const v of row) peak = Math.max(peak, Math.abs(v));
    const color = new THREE.Color();
    from.nodes.forEach((a, i) => {
      to.nodes.forEach((b, j) => {
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const w = weights?.[i]?.[j];
        if (typeof w === "number" && peak > 0) {
          const strength = Math.pow(Math.abs(w) / peak, 1.5);
          color.copy(w >= 0 ? POS : NEG).multiplyScalar(0.03 + 0.72 * strength);
        } else {
          color.setScalar(0.045);
        }
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      });
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, [from, to, weights]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

function Label({ placed, active }: { placed: Placed; active: boolean }) {
  const { layer, real, sized } = placed;
  const lines = useMemo(() => {
    const out = [layer.type.toUpperCase()];
    if (sized) {
      const count = real! > MAX_NODES ? `${MAX_NODES} OF ${real!.toLocaleString()}` : String(real);
      out.push(layer.shape && layer.shape.length > 1 ? `${count} · ${layer.shape.join("×")}` : count);
    }
    if (layer.activation) out.push(layer.activation.toUpperCase());
    if (typeof layer.params === "number" && layer.params > 0) out.push(`${layer.params.toLocaleString()} PARAMS`);
    return out;
  }, [layer, real, sized]);

  // labels are drawn to a small canvas and shown as a sprite, so they live inside the 3D scene
  const { texture, aspect } = useMemo(() => {
    const scale = 4;
    const lineHeight = 15;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = `500 11px ui-monospace, "Cascadia Mono", Consolas, monospace`;
    ctx.font = font;
    const width = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12);
    const height = lines.length * lineHeight + 4;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => {
      const y = 2 + lineHeight * (i + 0.5);
      if (i === 0 && active) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 2, width, lineHeight);
        ctx.fillStyle = "#000000";
      } else {
        ctx.fillStyle = active ? "#ffffff" : i === 0 ? "#d0d0d0" : "#8f8f8f";
      }
      ctx.fillText(line, width / 2, y + 0.5);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { texture: tex, aspect: width / height };
  }, [lines, active]);

  useEffect(() => () => texture.dispose(), [texture]);

  const rows = sized ? Math.ceil(placed.nodes.length / Math.ceil(Math.sqrt(placed.nodes.length))) : 3;
  const height = 0.3 * lines.length + 0.08;
  const y = -((rows - 1) / 2) * SPACING - 0.4 - height / 2;
  return (
    <sprite position={[placed.x, y, 0]} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function FitCamera({ count }: { count: number }) {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const controls = useThree((state) => state.controls) as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    if (width < 2 || height < 2) return; // canvas not laid out yet
    const span = Math.max(1, count - 1) * GAP + 3;
    const aspect = width / height;
    const distance = Math.max(5, (span / (2 * Math.tan((50 * Math.PI) / 360) * aspect)) * 0.9 + 1);
    camera.position.set(-distance * 0.35, distance * 0.3, distance * 0.92);
    camera.lookAt(0, 0, 0);
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [camera, controls, count, width, height]);
  return null;
}

export default function Network3D({
  layers,
  weights,
  activeLine,
  training,
}: {
  layers: Layer[];
  weights: Record<number, number[][]>;
  activeLine: number | null;
  training: boolean;
}) {
  const placed = useMemo(() => place(layers), [layers]);

  // The canvas measures its container once on mount and can miss it in React's
  // development double-mount, leaving a blank view. Nudge it to measure again.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timers = [50, 400].map((ms) =>
      setTimeout(() => {
        setTick((t) => t + 1);
        window.dispatchEvent(new Event("resize"));
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  const sized = placed.filter((p) => p.sized);

  return (
    <Canvas camera={{ fov: 50, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={["#000000"]} />
      <FitCamera count={placed.length} />
      <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={80} />
      {placed.map((p) => {
        const active = activeLine !== null && p.layer.line === activeLine;
        return (
          <group key={`${p.index}-${p.layer.type}`}>
            {p.sized ? <Nodes placed={p} active={active} training={training} /> : <Plate x={p.x} active={active} />}
            <Label placed={p} active={active} />
          </group>
        );
      })}
      {sized.slice(1).map((to, i) => (
        <Connections key={`${sized[i].index}-${to.index}`} from={sized[i]} to={to} weights={weights[to.index]} />
      ))}
    </Canvas>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { Choice, DIM, Frame, NEG, POS, Readout, Slider, plot, square, useCanvas, type Plot } from "./ui";

// ---------------------------------------------------------------- 1. text into tokens
export function Tokens() {
  const [text, setText] = useState("The cat sat on the mat. The dog sat on the log.");
  const [mode, setMode] = useState<"characters" | "words">("characters");
  const tokens = useMemo(
    () => (mode === "characters" ? [...text.toLowerCase()] : text.toLowerCase().match(/[a-z0-9']+|[^\sa-z0-9]/g) ?? []),
    [text, mode],
  );
  const ids = useMemo(() => {
    const vocabulary = new Map<string, number>();
    return tokens.map((t) => {
      if (!vocabulary.has(t)) vocabulary.set(t, vocabulary.size);
      return vocabulary.get(t)!;
    });
  }, [tokens]);
  const vocabularySize = new Set(tokens).size;

  return (
    <Frame
      controls={
        <>
          <Choice label="Split into" value={mode} options={["characters", "words"] as const} onChange={setMode} />
          <Readout label="Sequence length" value={String(tokens.length)} tone={mode === "words" ? "pos" : undefined} />
          <Readout label="Different tokens (vocabulary)" value={String(vocabularySize)} tone={mode === "characters" ? "pos" : undefined} />
        </>
      }
    >
      <div className="flex h-full flex-col gap-3 p-4">
        <label className="flex flex-col gap-1">
          <span className="label">Type any sentence</span>
          <input
            type="text" value={text} maxLength={120} onChange={(event) => setText(event.target.value)}
            className="border border-line bg-black px-3 py-2 font-mono text-sm text-white"
          />
        </label>
        <div className="flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-auto">
          {tokens.map((token, i) => (
            <span key={i} className="flex flex-col items-center border border-line px-1.5 py-0.5">
              <span className="font-mono text-sm">{token === " " ? "␣" : token}</span>
              <span className="font-mono text-[10px] text-pos">{ids[i]}</span>
            </span>
          ))}
        </div>
        <p className="label">Each token becomes the green number. The model only ever sees the numbers.</p>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. word embeddings
// Hand-placed positions for illustration. Real embeddings have hundreds of dimensions and are learned.
const WORDS: Record<string, [number, number]> = {
  man: [1, 1], woman: [1, 2.2], king: [3, 1.2], queen: [3, 2.4], boy: [0.3, 0.6], girl: [0.3, 1.8], prince: [2.3, 0.8], princess: [2.3, 2],
  france: [-3.2, 1.6], paris: [-2, 1.9], italy: [-3.3, 0.7], rome: [-2.1, 1], japan: [-3.1, -0.2], tokyo: [-1.9, 0.1],
  cat: [1.4, -1.8], kitten: [0.9, -1.3], dog: [2.2, -2], puppy: [1.7, -1.5], lion: [2.9, -1.4],
};
const ANALOGIES = { "king − man + woman": ["king", "man", "woman"], "paris − france + italy": ["paris", "france", "italy"], "prince − boy + girl": ["prince", "boy", "girl"] } as const;
const NAMES = Object.keys(WORDS);
const near = (point: [number, number], skip: string[] = []) =>
  NAMES.filter((n) => !skip.includes(n)).sort((a, b) => Math.hypot(WORDS[a][0] - point[0], WORDS[a][1] - point[1]) - Math.hypot(WORDS[b][0] - point[0], WORDS[b][1] - point[1]));

export function Embeddings() {
  const [mode, setMode] = useState<"neighbours" | keyof typeof ANALOGIES>("neighbours");
  const [picked, setPicked] = useState("cat");
  const frame = useRef<Plot | null>(null);
  const analogy = mode === "neighbours" ? null : ANALOGIES[mode];
  const target: [number, number] | null = analogy
    ? [WORDS[analogy[0]][0] - WORDS[analogy[1]][0] + WORDS[analogy[2]][0], WORDS[analogy[0]][1] - WORDS[analogy[1]][1] + WORDS[analogy[2]][1]]
    : null;
  const neighbours = near(WORDS[picked], [picked]).slice(0, 3);
  const answer = target && analogy ? near(target, [...analogy])[0] : null;

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-4, 4], [-2.6, 3]);
    frame.current = p;
    const arrow = (a: [number, number], b: [number, number], color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.px(a[0]), p.py(a[1]));
      ctx.lineTo(p.px(b[0]), p.py(b[1]));
      ctx.stroke();
      square(ctx, p.px(b[0]), p.py(b[1]), 6, color);
    };
    if (analogy && target) {
      arrow(WORDS[analogy[1]], WORDS[analogy[2]], DIM);
      arrow(WORDS[analogy[0]], target, POS);
    } else {
      for (const n of neighbours) arrow(WORDS[picked], WORDS[n], POS);
    }
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const name of NAMES) {
      const [x, y] = WORDS[name];
      const hot = analogy ? name === answer || analogy.includes(name as never) : name === picked || neighbours.includes(name);
      square(ctx, p.px(x), p.py(y), hot ? 9 : 6, name === answer || (!analogy && name === picked) ? POS : "#fff");
      ctx.fillStyle = hot ? "#fff" : DIM;
      ctx.fillText(name, p.px(x) + 9, p.py(y));
    }
  }, [mode, picked]);

  const onClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const p = frame.current;
    if (!p || mode !== "neighbours") return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = p.x0 + ((event.clientX - box.left - p.left) / (p.right - p.left)) * (p.x1 - p.x0);
    const y = p.y1 - ((event.clientY - box.top - p.top) / (p.bottom - p.top)) * (p.y1 - p.y0);
    setPicked(near([x, y])[0]);
  };

  return (
    <Frame
      tall
      controls={
        <>
          <Choice label="Show" value={mode} options={["neighbours", "king − man + woman", "paris − france + italy", "prince − boy + girl"] as const} onChange={setMode} />
          {analogy ? (
            <Readout label="Lands nearest to" value={answer ?? "–"} tone="pos" />
          ) : (
            <Readout label={`Closest to “${picked}”`} value={neighbours.join(", ")} tone="pos" />
          )}
          <span className="max-w-xs text-sm text-dim">Positions placed by hand to illustrate the idea. Real embeddings are learned and have hundreds of dimensions.</span>
        </>
      }
    >
      <canvas ref={ref} onClick={onClick} className={`h-full w-full ${mode === "neighbours" ? "cursor-pointer" : ""}`} role="img" aria-label="Words placed on a map so that related words sit close together" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. beam search
// A hand-written toy model: probability of each next word given the words so far.
const NEXT: Record<string, [string, number][]> = {
  The: [["nice", 0.5], ["dog", 0.4], ["car", 0.1]],
  "The nice": [["woman", 0.4], ["house", 0.3], ["guy", 0.3]],
  "The dog": [["has", 0.9], ["runs", 0.05], ["and", 0.05]],
  "The car": [["drives", 0.5], ["is", 0.3], ["turns", 0.2]],
  "The nice woman": [["is", 0.5], ["sings", 0.3], ["left", 0.2]],
  "The nice house": [["is", 0.6], ["was", 0.4]],
  "The nice guy": [["is", 0.5], ["said", 0.5]],
  "The dog has": [["a", 0.7], ["the", 0.3]],
  "The dog runs": [["fast", 0.6], ["away", 0.4]],
  "The dog and": [["the", 1]],
  "The car drives": [["fast", 1]],
  "The car is": [["red", 0.5], ["fast", 0.5]],
  "The car turns": [["left", 1]],
};
type Candidate = { text: string; p: number; kept: boolean };

function beamSearch(width: number) {
  let beams: Candidate[] = [{ text: "The", p: 1, kept: true }];
  const rounds: Candidate[][] = [];
  for (let step = 0; step < 3; step++) {
    const expanded = beams
      .filter((b) => b.kept)
      .flatMap((b) => (NEXT[b.text] ?? []).map(([word, p]) => ({ text: `${b.text} ${word}`, p: b.p * p, kept: false })))
      .sort((a, b) => b.p - a.p);
    expanded.forEach((c, i) => (c.kept = i < width));
    rounds.push(expanded);
    beams = expanded;
  }
  return rounds;
}

export function BeamSearch() {
  const [width, setWidth] = useState(1);
  const rounds = useMemo(() => beamSearch(width), [width]);
  const best = rounds[2].find((c) => c.kept)!;
  const optimum = 0.4 * 0.9 * 0.7;

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Beam width (sentences kept alive)" value={width} min={1} max={3} step={1} onChange={setWidth} format={(v) => (v === 1 ? "1 (greedy)" : String(v))} />
          <Readout label="Final sentence" value={best.text} tone={Math.abs(best.p - optimum) < 1e-9 ? "pos" : "neg"} />
          <Readout label="Its probability" value={best.p.toFixed(3)} />
          <Readout label="Best that exists" value={optimum.toFixed(3)} />
        </>
      }
    >
      <div className="grid h-full grid-cols-3 gap-3 overflow-auto p-4">
        {rounds.map((round, step) => (
          <div key={step} className="flex flex-col gap-1">
            <p className="label mb-1">Word {step + 2}</p>
            {round.slice(0, 9).map((c) => (
              <div key={c.text} className={`border px-2 py-1 ${c.kept ? "border-pos" : "border-line opacity-45"}`}>
                <p className="truncate font-mono text-xs">{c.text}</p>
                <p className={`font-mono text-[11px] tabular-nums ${c.kept ? "text-pos" : "text-dim"}`}>{c.p.toFixed(3)} {c.kept ? "· kept" : "· dropped"}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. positional encoding
const DIMS = 24;
const POSITIONS = 40;
const encoding = (position: number) =>
  Array.from({ length: DIMS }, (_, d) => {
    const angle = position / Math.pow(10000, (2 * Math.floor(d / 2)) / DIMS);
    return d % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
  });
const TABLE = Array.from({ length: POSITIONS }, (_, p) => encoding(p));

export function Positional() {
  const [a, setA] = useState(5);
  const [b, setB] = useState(6);
  const similarity = TABLE[a].reduce((s, v, i) => s + v * TABLE[b][i], 0) / (DIMS / 2);

  const ref = useCanvas((ctx, w, h) => {
    const left = 44, top = 8, right = w - 10, bottom = h - 22;
    const cw = (right - left) / POSITIONS, ch = (bottom - top) / DIMS;
    for (let pos = 0; pos < POSITIONS; pos++) {
      for (let d = 0; d < DIMS; d++) {
        const v = TABLE[pos][d];
        const size = Math.max(1.5, Math.abs(v) * Math.min(cw, ch) * 0.85);
        square(ctx, left + (pos + 0.5) * cw, top + (d + 0.5) * ch, size, v >= 0 ? "#fff" : NEG);
      }
    }
    for (const [pos, color] of [[a, POS], [b, "#fff"]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(left + pos * cw, top, cw, bottom - top);
    }
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = DIM;
    ctx.textAlign = "center";
    ctx.fillText("position in the sentence ▸", (left + right) / 2, h - 6);
    ctx.save();
    ctx.translate(14, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("24 numbers per position", 0, 0);
    ctx.restore();
  }, [a, b]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Position A (green)" value={a} min={0} max={POSITIONS - 1} step={1} onChange={setA} />
          <Slider label="Position B (white)" value={b} min={0} max={POSITIONS - 1} step={1} onChange={setB} />
          <Readout label="Positions apart" value={String(Math.abs(a - b))} />
          <Readout label="How alike their patterns are" value={similarity.toFixed(2)} tone={similarity > 0.8 ? "pos" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Sinusoidal positional encoding for forty positions" />
    </Frame>
  );
}

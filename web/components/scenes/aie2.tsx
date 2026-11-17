"use client";

import { useMemo, useState } from "react";
import { Choice, Frame, Readout, Slider, rng } from "./ui";

// A toy language model: it only looks at the previous word. Scores are hand-written
// for illustration. Real models read the whole context and have ~100,000 tokens.
const BIGRAMS: Record<string, [string, number][]> = {
  the: [["cat", 3], ["dog", 2.8], ["mat", 2.5], ["floor", 2.2], ["moon", 1], ["sun", 0.8]],
  cat: [["sat", 3.2], ["slept", 2.6], ["ran", 2.2], ["ate", 1.8], ["is", 1.5]],
  dog: [["ran", 3], ["barked", 2.9], ["sat", 2.2], ["slept", 2], ["ate", 1.8]],
  sat: [["on", 3.8], ["down", 2.2], ["quietly", 1.4], ["and", 1.2]],
  on: [["the", 4], ["a", 2.5], ["my", 1.5]],
  a: [["mat", 2.6], ["cat", 2.4], ["dog", 2.3], ["floor", 1.8]],
  my: [["cat", 2.6], ["dog", 2.5], ["mat", 1.6], ["floor", 1.5]],
  mat: [[".", 3], ["and", 2.5], ["quietly", 1]],
  floor: [[".", 3], ["and", 2.4]],
  moon: [[".", 2.5], ["and", 2], ["is", 1.5]],
  sun: [[".", 2.5], ["and", 2], ["is", 1.6]],
  slept: [["on", 3], ["quietly", 2.4], [".", 2], ["and", 1.8]],
  ran: [["and", 2.2], [".", 2.2], ["quietly", 1.6], ["on", 1.2]],
  ate: [[".", 2.5], ["and", 2], ["quietly", 1.5]],
  barked: [[".", 2.6], ["and", 2.2], ["quietly", 1.4]],
  is: [["on", 2.2], ["a", 2], ["my", 1.2]],
  down: [["on", 2.4], [".", 2.4], ["and", 2]],
  quietly: [[".", 2.6], ["and", 2.2], ["on", 2]],
  and: [["the", 3], ["a", 2.2], ["my", 1.8]],
  ".": [["the", 3], ["a", 2], ["my", 1.5]],
};

function softmax(logits: number[], temperature = 1) {
  const t = Math.max(temperature, 0.01);
  const peak = Math.max(...logits);
  const exps = logits.map((l) => Math.exp((l - peak) / t));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

function pick(probabilities: number[], u: number) {
  let acc = 0;
  for (let i = 0; i < probabilities.length; i++) {
    acc += probabilities[i];
    if (u <= acc) return i;
  }
  return probabilities.length - 1;
}

function Bars({
  rows, onPick,
}: { rows: { token: string; p: number; off?: boolean; note?: string }[]; onPick?: (token: string) => void }) {
  const top = Math.max(...rows.map((r) => r.p), 0.001);
  return (
    <ul className="flex h-full flex-col justify-center gap-1.5 overflow-auto px-4 py-3">
      {rows.map((row) => {
        const body = (
          <>
            <span className={`w-20 shrink-0 text-right font-mono text-sm ${row.off ? "text-faint line-through" : "text-white"}`}>{row.token}</span>
            <span className="relative h-5 flex-1">
              <span className={`absolute inset-y-0 left-0 ${row.off ? "bg-[#2a2a2a]" : "bg-white"}`} style={{ width: `${(row.p / top) * 100}%`, minWidth: row.p > 0 ? 2 : 0 }} />
            </span>
            <span className={`w-14 shrink-0 text-right font-mono text-xs tabular-nums ${row.off ? "text-faint" : "text-dim"}`}>
              {(row.p * 100).toFixed(1)}%
            </span>
          </>
        );
        return (
          <li key={row.token}>
            {onPick ? (
              <button onClick={() => onPick(row.token)} className="flex w-full items-center gap-3 hover:bg-[#101010]" title={`Add "${row.token}"`}>
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- 1. next token
export function NextToken() {
  const [words, setWords] = useState(["the", "cat", "sat", "on"]);
  const [draws, setDraws] = useState(0);
  const options = BIGRAMS[words[words.length - 1]] ?? BIGRAMS["."];
  const probabilities = softmax(options.map(([, score]) => score));

  const add = (word: string) => setWords((w) => (w.length >= 24 ? w : [...w, word]));
  const sample = () => {
    const u = rng(draws * 7919 + words.length * 31 + 5).next();
    setDraws((d) => d + 1);
    add(options[pick(probabilities, u)][0]);
  };

  return (
    <Frame
      controls={
        <>
          <button className="btn btn-solid" onClick={sample}>Let the model pick</button>
          <button className="btn" onClick={() => setWords(["the"])}>Start over</button>
          <span className="max-w-md text-sm text-dim">
            Toy model with hand-written scores. It only sees the last word; real models read everything before it.
          </span>
        </>
      }
    >
      <div className="flex h-full flex-col">
        <p className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-3 font-mono text-sm" aria-live="polite">
          {words.map((word, i) => (
            <span key={i} className={i === words.length - 1 ? "bg-white px-1.5 text-black" : "border border-line px-1.5"}>{word}</span>
          ))}
          <span className="blink px-1 text-dim">▮ ?</span>
        </p>
        <div className="min-h-0 flex-1">
          <Bars rows={options.map(([token], i) => ({ token, p: probabilities[i] }))} onPick={add} />
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2/3. sampling
const CANDIDATES: [string, number][] = [
  ["mat", 4.1], ["floor", 3.6], ["couch", 3.3], ["bed", 3.0], ["roof", 2.4],
  ["table", 2.2], ["grass", 1.9], ["keyboard", 1.2], ["moon", 0.3], ["piano", 0.1],
];

export function Sampler({ truncation = false }: { truncation?: boolean }) {
  const [temperature, setTemperature] = useState(1);
  const [topK, setTopK] = useState(CANDIDATES.length);
  const [topP, setTopP] = useState(1);
  const [draw, setDraw] = useState(0);

  const { rows, final } = useMemo(() => {
    const base = softmax(CANDIDATES.map(([, l]) => l), temperature);
    const order = base.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
    const keep = new Set<number>();
    let mass = 0;
    order.forEach(({ p, i }, rank) => {
      if (rank < topK && (mass < topP || rank === 0)) keep.add(i);
      mass += p;
    });
    const kept = base.reduce((s, p, i) => s + (keep.has(i) ? p : 0), 0);
    const finalP = base.map((p, i) => (keep.has(i) ? p / kept : 0));
    return {
      final: finalP,
      rows: CANDIDATES.map(([token], i) => ({ token, p: keep.has(i) ? finalP[i] : base[i], off: !keep.has(i) })),
    };
  }, [temperature, topK, topP]);

  const samples = useMemo(() => {
    if (draw === 0) return [];
    const r = rng(draw * 104729);
    return Array.from({ length: 12 }, () => CANDIDATES[pick(final, r.next())][0]);
  }, [draw, final]);

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Temperature" value={temperature} min={0.05} max={2.5} step={0.05} onChange={setTemperature} format={(v) => v.toFixed(2)} />
          {truncation && (
            <>
              <Slider label="Top-k" value={topK} min={1} max={CANDIDATES.length} step={1} onChange={setTopK} />
              <Slider label="Top-p" value={topP} min={0.1} max={1} step={0.05} onChange={setTopP} format={(v) => v.toFixed(2)} />
            </>
          )}
          <Readout label="Tokens in play" value={`${rows.filter((r) => !r.off).length} / ${rows.length}`} />
          <button className="btn btn-solid" onClick={() => setDraw((d) => d + 1)}>Sample 12 times</button>
        </>
      }
    >
      <div className="flex h-full flex-col">
        <p className="border-b border-line px-4 py-3 font-mono text-sm">
          <span className="text-dim">The cat sat on the</span> <span className="blink">▮</span>
        </p>
        <div className="min-h-0 flex-1"><Bars rows={rows} /></div>
        <p className="flex min-h-11 flex-wrap items-center gap-1.5 border-t border-line px-4 py-2 font-mono text-xs" aria-live="polite">
          {samples.length === 0 ? (
            <span className="text-dim">Press “Sample 12 times” to see what the model would actually say.</span>
          ) : (
            samples.map((token, i) => <span key={i} className="border border-line px-1.5 py-0.5">{token}</span>)
          )}
        </p>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. attention
const ENDINGS = { tired: "animal", wide: "street" } as const;

function attention(tokens: string[], from: number, ending: keyof typeof ENDINGS): number[] {
  // Illustrative weights, not taken from a real model.
  const weights = tokens.map((_, i) => (i === from ? 0.25 : Math.max(0.01, 0.12 - Math.abs(i - from) * 0.03)));
  const word = tokens[from];
  const boost = (target: string, amount: number) => {
    const i = tokens.indexOf(target);
    if (i >= 0) weights[i] += amount;
  };
  if (word === "it") boost(ENDINGS[ending], 1.2);
  if (word === ending) { boost(ENDINGS[ending], 0.7); boost("it", 0.5); }
  if (word === "cross") { boost("animal", 0.5); boost("street", 0.5); }
  if (word === "didn't") boost("cross", 0.6);
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / total);
}

export function Attention() {
  const [ending, setEnding] = useState<keyof typeof ENDINGS>("tired");
  const tokens = useMemo(() => ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", "too", ending], [ending]);
  const [from, setFrom] = useState(7);
  const weights = attention(tokens, from, ending);
  const peak = Math.max(...weights);
  const strongest = tokens[weights.indexOf(Math.max(...weights.map((w, i) => (i === from ? 0 : w))))];
  const rowHeight = 100 / tokens.length;

  return (
    <Frame
      tall
      controls={
        <>
          <Choice label="Sentence ends with" value={ending} options={["tired", "wide"] as const} onChange={setEnding} />
          <Readout label={`“${tokens[from]}” looks most at`} value={strongest} tone="pos" />
          <span className="max-w-md text-sm text-dim">Click any word on the left. Weights here are illustrative, not from a real model.</span>
        </>
      }
    >
      <div className="relative mx-auto grid h-full max-w-xl grid-cols-[1fr_2fr_1fr] px-4 py-2">
        <ul className="flex flex-col">
          {tokens.map((token, i) => (
            <li key={i} className="flex flex-1 items-center justify-end">
              <button
                onClick={() => setFrom(i)}
                aria-pressed={i === from}
                className={`px-2 font-mono text-sm ${i === from ? "bg-white text-black" : "text-dim hover:text-white"}`}
              >
                {token}
              </button>
            </li>
          ))}
        </ul>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
          {weights.map((w, i) => (
            <line
              key={i}
              x1={0} y1={(from + 0.5) * rowHeight} x2={100} y2={(i + 0.5) * rowHeight}
              stroke="#fff" strokeOpacity={0.08 + 0.92 * (w / peak)} strokeWidth={0.3 + 2.2 * (w / peak)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <ul className="flex flex-col">
          {tokens.map((token, i) => (
            <li key={i} className="flex flex-1 items-center gap-2 font-mono text-sm">
              <span style={{ opacity: 0.35 + 0.65 * (weights[i] / peak) }}>{token}</span>
              <span className="text-[11px] tabular-nums text-dim">{(weights[i] * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 5. memory math
const DEVICES = [
  { name: "Your RTX 2050", gb: 4 },
  { name: "Kaggle T4", gb: 16 },
  { name: "High-end desktop GPU", gb: 24 },
  { name: "Data-centre GPU", gb: 80 },
];
const PRECISIONS = { "32-bit": 32, "16-bit": 16, "8-bit": 8, "4-bit": 4 } as const;

export function ModelMemory() {
  const [exponent, setExponent] = useState(0.85); // log10 of billions of parameters
  const [precision, setPrecision] = useState<keyof typeof PRECISIONS>("16-bit");
  const billions = 10 ** exponent;
  const gigabytes = (billions * 1e9 * PRECISIONS[precision]) / 8 / 1e9;
  const scale = Math.max(96, gigabytes * 1.15);

  return (
    <Frame
      controls={
        <>
          <Slider label="Model size (parameters)" value={exponent} min={-1} max={2.7} step={0.05} onChange={setExponent}
            format={() => (billions < 1 ? `${Math.round(billions * 1000)} million` : `${billions.toFixed(billions < 10 ? 1 : 0)} billion`)} />
          <Choice label="Bits per parameter" value={precision} options={["32-bit", "16-bit", "8-bit", "4-bit"] as const} onChange={setPrecision} />
          <Readout label="Memory for the weights" value={`${gigabytes < 10 ? gigabytes.toFixed(1) : Math.round(gigabytes)} GB`} />
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-4 px-4">
        <div>
          <p className="label mb-1">Weights of this model</p>
          <div className="h-7 bg-white" style={{ width: `${Math.max(0.5, (gigabytes / scale) * 100)}%` }} />
        </div>
        {DEVICES.map((device) => {
          const fits = gigabytes <= device.gb;
          return (
            <div key={device.name}>
              <p className="label mb-1 flex gap-3">
                {device.name} · {device.gb} GB
                <span className={fits ? "text-pos" : "text-neg"}>{fits ? "fits" : "does not fit"}</span>
              </p>
              <div className="h-4 border border-line" style={{ width: `${(device.gb / scale) * 100}%`, borderColor: fits ? "#7cffb2" : "#ff5c7a" }} />
            </div>
          );
        })}
        <p className="text-sm text-dim">Weights only. Running the model needs extra memory on top for its working data.</p>
      </div>
    </Frame>
  );
}

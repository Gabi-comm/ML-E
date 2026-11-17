"use client";

import { useMemo, useState } from "react";
import { Choice, DIM, Frame, POS, Readout, Slider, plot, rng, square, useCanvas } from "./ui";

/** Horizontal bar with a label, used for qualitative comparisons. */
function Meter({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-wider text-dim">{label}</span>
      <span className="flex items-center gap-2">
        <span className="h-3 bg-white" style={{ width: `${Math.max(2, value * 100)}%` }} />
        {note && <span className="whitespace-nowrap font-mono text-[11px] text-dim">{note}</span>}
      </span>
    </div>
  );
}

// ================================================================ CHAPTER 1
const LAYERS = [
  { name: "Application development", who: "AI engineers", items: ["Prompts and context", "Evaluation", "The interface people use"], note: "Where most new work happens now. You adapt a model someone else trained." },
  { name: "Model development", who: "ML engineers and researchers", items: ["Training and finetuning", "Datasets", "Making inference faster"], note: "Changing the model itself. Needed less often when strong models already exist." },
  { name: "Infrastructure", who: "Platform teams", items: ["Serving models", "Compute and data", "Monitoring"], note: "Keeps everything running. Changes the least from one project to the next." },
];

export function Stack() {
  const [active, setActive] = useState(0);
  const layer = LAYERS[active];
  return (
    <Frame controls={<Readout label="Layer" value={`${active + 1} of 3 · ${layer.who}`} />}>
      <div className="grid h-full items-center gap-5 p-5 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          {LAYERS.map((l, i) => (
            <button
              key={l.name}
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={`border px-4 py-4 text-left font-mono text-sm uppercase tracking-wider ${i === active ? "border-white bg-white text-black" : "border-line text-dim hover:border-white hover:text-white"}`}
            >
              {l.name}
            </button>
          ))}
          <p className="label mt-1">▴ built on top of ▾</p>
        </div>
        <div aria-live="polite">
          <p className="text-lg text-white/90">{layer.note}</p>
          <ul className="mt-3 border-t border-line">
            {layer.items.map((item) => (
              <li key={item} className="flex items-center gap-2 border-b border-line py-2 text-white/80"><span className="px opacity-60" />{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  );
}

const SENTENCE = ["My", "favourite", "street", "food", "is", "grilled", "banana", "on", "a", "stick"];

export function SelfSupervision() {
  const [cut, setCut] = useState(3);
  return (
    <Frame
      controls={
        <>
          <Slider label="Where to hide the next word" value={cut} min={1} max={SENTENCE.length - 1} step={1} onChange={setCut} />
          <Readout label="Training examples from this one sentence" value={String(SENTENCE.length - 1)} tone="pos" />
          <Readout label="Labels written by a person" value="0" />
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-6 p-5">
        <div>
          <p className="label mb-2">The model is shown</p>
          <p className="flex flex-wrap gap-1.5 font-mono text-base">
            {SENTENCE.slice(0, cut).map((w, i) => <span key={i} className="border border-white/60 px-2 py-1">{w}</span>)}
            <span className="blink border border-dashed border-pos px-2 py-1 text-pos">?</span>
          </p>
        </div>
        <div>
          <p className="label mb-2">And must predict</p>
          <p className="font-mono text-base"><span className="bg-pos px-2 py-1 text-black">{SENTENCE[cut]}</span></p>
        </div>
        <p className="text-sm text-dim">The text supplies its own answers. That is why language models can learn from the whole internet without anyone labelling it.</p>
      </div>
    </Frame>
  );
}

// Rough, qualitative comparison: bar lengths show relative order, not measurements.
const LADDER = [
  { name: "Prompting", data: 0.03, cost: 0.03, time: 0.03, when: "Always start here. Change the instructions and examples, not the model.", notes: ["a few examples", "almost free", "minutes"] },
  { name: "Adding context (RAG)", data: 0.2, cost: 0.15, time: 0.15, when: "The model lacks information: your documents, recent facts, private data.", notes: ["your documents", "a search system", "days"] },
  { name: "Finetuning", data: 0.5, cost: 0.45, time: 0.45, when: "The model has the information but behaves wrongly: format, style, a narrow skill.", notes: ["hundreds to thousands of examples", "GPU hours", "weeks"] },
  { name: "Training from scratch", data: 1, cost: 1, time: 1, when: "Almost never. Only when no existing model fits at all.", notes: ["a huge corpus", "very large", "months or more"] },
];

export function AdaptLadder() {
  const [step, setStep] = useState(0);
  const rung = LADDER[step];
  return (
    <Frame
      controls={
        <>
          <Slider label="How far you change things" value={step} min={0} max={3} step={1} onChange={setStep} format={() => rung.name} />
          <span className="max-w-sm text-sm text-dim">Bar lengths show the rough order of effort, not measured numbers.</span>
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-5 p-5">
        <ol className="grid grid-cols-4 gap-1">
          {LADDER.map((l, i) => (
            <li key={l.name}>
              <button onClick={() => setStep(i)} aria-pressed={i === step} className={`h-full w-full border p-2 text-left text-xs ${i === step ? "border-white bg-white text-black" : i < step ? "border-white/50" : "border-line text-dim"}`}>
                <span className="block font-mono">{i + 1}</span>{l.name}
              </button>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2">
          <Meter label="Data you need" value={rung.data} note={rung.notes[0]} />
          <Meter label="Cost" value={rung.cost} note={rung.notes[1]} />
          <Meter label="Time to try it" value={rung.time} note={rung.notes[2]} />
        </div>
        <p className="text-lg text-white/90" aria-live="polite"><span className="label mr-2 text-pos">Use when</span>{rung.when}</p>
      </div>
    </Frame>
  );
}

// ================================================================ CHAPTER 3
const NEXT_WORDS = ["mat", "floor", "couch", "bed", "roof", "table", "grass", "moon"];

export function Perplexity() {
  const [sharp, setSharp] = useState(1);
  const probs = useMemo(() => {
    const raw = NEXT_WORDS.map((_, i) => Math.exp(-i * sharp));
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map((v) => v / total);
  }, [sharp]);
  const entropy = -probs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
  const perplexity = Math.pow(2, entropy);

  return (
    <Frame
      controls={
        <>
          <Slider label="How sure the model is" value={sharp} min={0} max={3} step={0.05} onChange={setSharp} format={(v) => (v < 0.3 ? "clueless" : v > 2 ? "very sure" : "somewhat")} />
          <Readout label="Entropy" value={`${entropy.toFixed(2)} bits`} />
          <Readout label="Perplexity" value={perplexity.toFixed(2)} tone={perplexity < 2 ? "pos" : perplexity > 6 ? "neg" : undefined} />
          <span className="max-w-xs text-sm text-dim">Like hesitating between {perplexity.toFixed(1)} equally likely words.</span>
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-1.5 px-5">
        <p className="mb-2 font-mono text-sm text-dim">The cat sat on the <span className="blink text-white">▮</span></p>
        {NEXT_WORDS.map((word, i) => (
          <div key={word} className="flex items-center gap-3">
            <span className="w-14 text-right font-mono text-sm">{word}</span>
            <span className="h-5 flex-1"><span className="block h-full bg-white" style={{ width: `${(probs[i] / probs[0]) * 100}%`, minWidth: 2 }} /></span>
            <span className="w-14 text-right font-mono text-xs tabular-nums text-dim">{(probs[i] * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

const REFERENCE = "The meeting was moved to Friday afternoon";
// "meaning" scores are illustrative: a real system would compute them with an embedding model.
const CANDIDATES = {
  "same words": { text: "The meeting was moved to Friday afternoon", meaning: 1 },
  "same meaning, new words": { text: "They rescheduled the session for late on Friday", meaning: 0.9 },
  "same words, wrong meaning": { text: "The meeting was not moved to Friday afternoon", meaning: 0.25 },
  unrelated: { text: "I had noodles for lunch today", meaning: 0.03 },
} as const;
const wordsOf = (text: string): string[] => text.toLowerCase().match(/[a-z']+/g) ?? [];

export function Similarity() {
  const [pick, setPick] = useState<keyof typeof CANDIDATES>("same meaning, new words");
  const candidate = CANDIDATES[pick];
  const ref = wordsOf(REFERENCE), cand = wordsOf(candidate.text);
  const shared = cand.filter((w) => ref.includes(w)).length;
  const precision = shared / cand.length, recall = ref.filter((w) => cand.includes(w)).length / ref.length;
  const overlap = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const exact = REFERENCE.toLowerCase() === candidate.text.toLowerCase();

  return (
    <Frame
      controls={
        <>
          <Choice label="Model's answer" value={pick} options={["same words", "same meaning, new words", "same words, wrong meaning", "unrelated"] as const} onChange={setPick} />
          <Readout label="Exact match" value={exact ? "1" : "0"} tone={exact ? "pos" : "neg"} />
          <Readout label="Word overlap" value={overlap.toFixed(2)} />
          <Readout label="Meaning (illustrative)" value={candidate.meaning.toFixed(2)} tone={candidate.meaning > 0.7 ? "pos" : "neg"} />
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-5 p-5">
        <div>
          <p className="label mb-1">Reference answer</p>
          <p className="flex flex-wrap gap-1 font-mono">{REFERENCE.split(" ").map((w, i) => <span key={i} className="border border-line px-1.5 py-0.5">{w}</span>)}</p>
        </div>
        <div>
          <p className="label mb-1">Model&apos;s answer · green = word also in the reference</p>
          <p className="flex flex-wrap gap-1 font-mono">
            {candidate.text.split(" ").map((w, i) => (
              <span key={i} className={`border px-1.5 py-0.5 ${ref.includes(w.toLowerCase()) ? "border-pos text-pos" : "border-line text-dim"}`}>{w}</span>
            ))}
          </p>
        </div>
        <p className="text-sm text-dim">Word overlap is computed here. The meaning score is a fixed example value.</p>
      </div>
    </Frame>
  );
}

const TRUE_STRENGTH = [1650, 1560, 1500, 1380];
const MODEL_NAMES = ["Model A", "Model B", "Model C", "Model D"];

/** Play pairwise matches and update Elo ratings after each one. */
function tournament(matches: number) {
  const r = rng(321);
  const ratings = [1500, 1500, 1500, 1500];
  for (let m = 0; m < matches; m++) {
    const i = Math.floor(r.next() * 4);
    let j = Math.floor(r.next() * 3);
    if (j >= i) j += 1;
    const pTrue = 1 / (1 + Math.pow(10, (TRUE_STRENGTH[j] - TRUE_STRENGTH[i]) / 400));
    const won = r.next() < pTrue ? 1 : 0;
    const expected = 1 / (1 + Math.pow(10, (ratings[j] - ratings[i]) / 400));
    ratings[i] += 24 * (won - expected);
    ratings[j] -= 24 * (won - expected);
  }
  return ratings;
}

export function Elo() {
  const [matches, setMatches] = useState(0);
  const ratings = useMemo(() => tournament(matches), [matches]);
  const order = [0, 1, 2, 3].sort((a, b) => ratings[b] - ratings[a]);
  const correct = order.every((m, i) => m === i);

  return (
    <Frame
      controls={
        <>
          <button className="btn" onClick={() => setMatches((m) => m + 1)}>+1 comparison</button>
          <button className="btn btn-solid" onClick={() => setMatches((m) => m + 25)}>+25 comparisons</button>
          <button className="btn btn-quiet" onClick={() => setMatches(0)}>Reset</button>
          <Readout label="Comparisons so far" value={String(matches)} />
          <Readout label="Ranking matches the truth" value={matches === 0 ? "–" : correct ? "Yes" : "Not yet"} tone={matches === 0 ? undefined : correct ? "pos" : "neg"} />
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-3 px-5">
        {order.map((m, rank) => (
          <div key={m} className="grid grid-cols-[1.5rem_5rem_1fr_3.5rem] items-center gap-3">
            <span className="font-mono text-sm text-dim">{rank + 1}</span>
            <span className="font-mono text-sm">{MODEL_NAMES[m]}</span>
            <span className="relative h-6 border border-line">
              <span className="absolute inset-y-0 left-0 bg-white" style={{ width: `${Math.max(1, ((ratings[m] - 1300) / 450) * 100)}%` }} />
              <span className="absolute inset-y-0 w-0.5 bg-pos" style={{ left: `${((TRUE_STRENGTH[m] - 1300) / 450) * 100}%` }} title="true strength" />
            </span>
            <span className="text-right font-mono text-sm tabular-nums">{Math.round(ratings[m])}</span>
          </div>
        ))}
        <p className="label mt-1">white bar = rating from comparisons so far · green line = hidden true strength</p>
      </div>
    </Frame>
  );
}

// ================================================================ CHAPTER 4
// Made-up models for illustration: quality score, price per million tokens, seconds per answer.
const OPTIONS = [
  { name: "A", quality: 92, cost: 15, latency: 6 }, { name: "B", quality: 88, cost: 5, latency: 3.5 }, { name: "C", quality: 84, cost: 3, latency: 2 },
  { name: "D", quality: 79, cost: 0.8, latency: 1.2 }, { name: "E", quality: 72, cost: 0.3, latency: 0.8 }, { name: "F", quality: 86, cost: 9, latency: 1.6 },
  { name: "G", quality: 64, cost: 0.1, latency: 0.5 }, { name: "H", quality: 90, cost: 11, latency: 4.5 },
];

export function TradeOff() {
  const [quality, setQuality] = useState(75);
  const [cost, setCost] = useState(10);
  const [latency, setLatency] = useState(4);
  const passing = OPTIONS.filter((m) => m.quality >= quality && m.cost <= cost && m.latency <= latency);
  const choice = [...passing].sort((a, b) => a.cost - b.cost)[0];

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [-1.2, 1.4], [60, 95], { x: "price per million tokens (log scale: $0.10 → $20)", y: "quality score" });
    ctx.fillStyle = "rgba(255,92,122,0.08)";
    ctx.fillRect(p.left, p.py(quality), p.right - p.left, p.bottom - p.py(quality));
    ctx.fillRect(p.px(Math.log10(cost)), p.top, p.right - p.px(Math.log10(cost)), p.bottom - p.top);
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const m of OPTIONS) {
      const ok = passing.includes(m);
      const x = p.px(Math.log10(m.cost)), y = p.py(m.quality);
      square(ctx, x, y, 6 + m.latency * 2.5, m === choice ? POS : ok ? "#fff" : "#444", !ok);
      ctx.fillStyle = m === choice ? POS : ok ? "#fff" : DIM;
      ctx.fillText(m.name, x + 6 + m.latency * 1.4, y);
    }
  }, [quality, cost, latency]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Quality must be at least" value={quality} min={60} max={92} step={1} onChange={setQuality} />
          <Slider label="Price at most ($ / million tokens)" value={cost} min={0.1} max={20} step={0.1} onChange={setCost} format={(v) => `$${v.toFixed(1)}`} />
          <Slider label="Answer within (seconds)" value={latency} min={0.5} max={7} step={0.1} onChange={setLatency} format={(v) => `${v.toFixed(1)}s`} />
          <Readout label="Models that pass" value={`${passing.length} of ${OPTIONS.length}`} />
          <Readout label="Cheapest that passes" value={choice ? `Model ${choice.name}` : "none"} tone={choice ? "pos" : "neg"} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Models plotted by price and quality, filtered by requirements" />
      <p className="label pointer-events-none absolute right-4 top-3">made-up models · bigger square = slower · hollow = fails a requirement</p>
    </Frame>
  );
}

export function BuildBuy() {
  const [volume, setVolume] = useState(1.5); // log10 of million tokens per month
  const [price, setPrice] = useState(3);
  const [fixed, setFixed] = useState(1500);
  const millions = Math.pow(10, volume);
  const api = millions * price;
  const breakEven = fixed / price;

  const ref = useCanvas((ctx, w, h) => {
    const top = Math.max(4000, fixed * 2);
    const p = plot(ctx, w, h, [0, 4], [0, top], { x: "million tokens per month (log scale: 1 → 10,000)", y: "monthly cost $" });
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const x = (i / 100) * 4, y = Math.min(top * 1.02, Math.pow(10, x) * price);
      if (i === 0) ctx.moveTo(p.px(x), p.py(y));
      else ctx.lineTo(p.px(x), p.py(y));
    }
    ctx.stroke();
    ctx.strokeStyle = POS;
    ctx.beginPath();
    ctx.moveTo(p.px(0), p.py(fixed));
    ctx.lineTo(p.px(4), p.py(fixed));
    ctx.stroke();
    ctx.strokeStyle = "#555";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.px(volume), p.top);
    ctx.lineTo(p.px(volume), p.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    square(ctx, p.px(volume), p.py(Math.min(top, api)), 10, "#fff");
  }, [volume, price, fixed]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Your usage" value={volume} min={0} max={4} step={0.05} onChange={setVolume} format={() => `${millions < 10 ? millions.toFixed(1) : Math.round(millions).toLocaleString()}M tokens`} />
          <Slider label="API price ($ / million tokens)" value={price} min={0.2} max={15} step={0.1} onChange={setPrice} format={(v) => `$${v.toFixed(1)}`} />
          <Slider label="Self-hosting fixed cost ($ / month)" value={fixed} min={300} max={6000} step={100} onChange={setFixed} format={(v) => `$${v.toLocaleString()}`} />
          <Readout label="API bill" value={`$${Math.round(api).toLocaleString()}`} tone={api < fixed ? "pos" : undefined} />
          <Readout label="Cheaper option now" value={api < fixed ? "Use the API" : "Host it yourself"} tone="pos" />
          <Readout label="Break-even" value={`${Math.round(breakEven).toLocaleString()}M tokens`} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Monthly cost of an API versus self-hosting as usage grows" />
      <p className="label pointer-events-none absolute right-4 top-3">white = pay per token · green = flat cost of your own servers (engineering time not included)</p>
    </Frame>
  );
}

export function Latency() {
  const [first, setFirst] = useState(0.8);
  const [speed, setSpeed] = useState(40);
  const [length, setLength] = useState(300);
  const total = first + length / speed;
  const scale = 100 / Math.max(total, 12);

  return (
    <Frame
      controls={
        <>
          <Slider label="Time to first token" value={first} min={0.1} max={5} step={0.1} onChange={setFirst} format={(v) => `${v.toFixed(1)}s`} />
          <Slider label="Tokens per second" value={speed} min={5} max={200} step={5} onChange={setSpeed} />
          <Slider label="Length of the answer (tokens)" value={length} min={20} max={1500} step={20} onChange={setLength} />
          <Readout label="User sees the first word after" value={`${first.toFixed(1)}s`} tone={first < 1 ? "pos" : first > 3 ? "neg" : undefined} />
          <Readout label="Full answer after" value={`${total.toFixed(1)}s`} />
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-6 px-5">
        <div>
          <p className="label mb-2">One request, from sending to the last word</p>
          <div className="flex h-10 w-full border border-line">
            <span className="grid place-items-center bg-neg/70 font-mono text-[11px] text-black" style={{ width: `${first * scale}%` }}>{first * scale > 9 ? "waiting" : ""}</span>
            <span className="grid place-items-center bg-white font-mono text-[11px] text-black" style={{ width: `${(length / speed) * scale}%` }}>{(length / speed) * scale > 14 ? "words streaming in" : ""}</span>
          </div>
        </div>
        <div className="grid gap-3 text-sm text-white/80 sm:grid-cols-2">
          <p><span className="label mr-2 text-neg">Waiting</span>Matters most for chat: people judge speed by how soon the answer starts.</p>
          <p><span className="label mr-2">Streaming</span>Matters most for long outputs and for programs that need the complete answer.</p>
        </div>
      </div>
    </Frame>
  );
}


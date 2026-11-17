"use client";

import { useMemo, useState } from "react";
import { Choice, Frame, NEG, POS, Readout, Slider, plot, rng, square, useCanvas } from "./ui";

const wordSet = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9']+/g) ?? []);
/** Share of words two texts have in common (Jaccard similarity). */
const jaccard = (a: string, b: string) => {
  const x = wordSet(a), y = wordSet(b);
  const common = [...x].filter((w) => y.has(w)).length;
  return common / (x.size + y.size - common || 1);
};

// ================================================================ CHAPTER 8
const EXAMPLES = [
  "How do I reset my password?",
  "How do I reset my password",
  "how can I reset my password?",
  "What are your opening hours?",
  "What are your opening hours on weekends?",
  "Can I get a refund for my order?",
  "How do I get a refund for my order?",
  "Do you ship to the provinces?",
  "Where is my parcel right now?",
  "What time do you open?",
];

export function Dedupe() {
  const [threshold, setThreshold] = useState(1);
  const removed = useMemo(() => {
    const kept: number[] = [];
    const out = new Map<number, number>();
    EXAMPLES.forEach((text, i) => {
      const match = kept.find((k) => jaccard(EXAMPLES[k], text) >= threshold);
      if (match === undefined) kept.push(i);
      else out.set(i, match);
    });
    return out;
  }, [threshold]);

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Treat as duplicate when this similar" value={threshold} min={0.3} max={1} step={0.05} onChange={setThreshold} format={(v) => `${Math.round(v * 100)}%`} />
          <Readout label="Examples kept" value={`${EXAMPLES.length - removed.size} of ${EXAMPLES.length}`} tone="pos" />
          <Readout label="Removed" value={String(removed.size)} tone={removed.size > 5 ? "neg" : undefined} />
        </>
      }
    >
      <ol className="flex h-full flex-col justify-center gap-1 overflow-auto p-4">
        {EXAMPLES.map((text, i) => {
          const twin = removed.get(i);
          return (
            <li key={i} className={`flex items-center justify-between gap-3 border px-3 py-1.5 text-sm ${twin === undefined ? "border-line" : "border-neg/50 text-dim line-through"}`}>
              <span><span className="mr-2 font-mono text-xs text-dim no-underline">{i + 1}</span>{text}</span>
              {twin !== undefined && <span className="shrink-0 font-mono text-[11px] text-neg" style={{ textDecoration: "none" }}>same as {twin + 1}</span>}
            </li>
          );
        })}
      </ol>
    </Frame>
  );
}

/**
 * Train a simple nearest-centre classifier on n examples and test it on clean data.
 * Eight features, only two of which carry signal. `noise` is the share of class-1
 * examples wrongly labelled as class 0 (one-sided mistakes, as careless labelling often is).
 */
const FEATURES = 8;
function accuracyFor(n: number, noise: number, seed: number) {
  const r = rng(seed);
  const sample = () => {
    const label = r.next() < 0.5 ? 0 : 1;
    const x = Array.from({ length: FEATURES }, (_, i) => (i === 0 ? (label ? 0.9 : -0.9) : i === 1 ? (label ? 0.6 : -0.6) : 0) + r.normal());
    return { x, label };
  };
  const sums = [new Array<number>(FEATURES).fill(0), new Array<number>(FEATURES).fill(0)];
  const counts = [0, 0];
  for (let i = 0; i < n; i++) {
    const p = sample();
    const seen = p.label === 1 && r.next() < noise ? 0 : p.label;
    p.x.forEach((v, k) => (sums[seen][k] += v));
    counts[seen] += 1;
  }
  const centres = sums.map((row, k) => row.map((v) => v / (counts[k] || 1)));
  const far = (x: number[], c: number[]) => x.reduce((t, v, k) => t + (v - c[k]) ** 2, 0);
  let right = 0;
  for (let i = 0; i < 400; i++) {
    const p = sample();
    const guess = counts[1] === 0 ? 0 : counts[0] === 0 ? 1 : far(p.x, centres[0]) < far(p.x, centres[1]) ? 0 : 1;
    if (guess === p.label) right++;
  }
  return right / 400;
}
const SIZES = [4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
const averaged = (n: number, noise: number) => Array.from({ length: 12 }, (_, s) => accuracyFor(n, noise, s * 97 + n)).reduce((a, b) => a + b, 0) / 12;

export function Quantity() {
  const [index, setIndex] = useState(2);
  const [percent, setPercent] = useState(0);
  const curve = useMemo(() => SIZES.map((n) => averaged(n, percent / 100)), [percent]);
  const clean = useMemo(() => SIZES.map((n) => averaged(n, 0)), []);
  const gain = index > 0 ? curve[index] - curve[index - 1] : 0;

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, SIZES.length - 1], [0.4, 0.9], { x: "training examples (doubling each step: 4 → 2,048)", y: "accuracy on new data" });
    const path = (values: number[], color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      values.forEach((v, i) => (i ? ctx.lineTo(p.px(i), p.py(v)) : ctx.moveTo(p.px(0), p.py(v))));
      ctx.stroke();
    };
    path(clean, "#555", 1.5);
    path(curve, "#fff", 2);
    square(ctx, p.px(index), p.py(curve[index]), 12, POS);
  }, [curve, clean, index]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Training examples" value={index} min={0} max={SIZES.length - 1} step={1} onChange={setIndex} format={() => SIZES[index].toLocaleString()} />
          <Slider label="Share of one class mislabelled" value={percent} min={0} max={90} step={5} onChange={setPercent} format={(v) => `${v}%`} />
          <Readout label="Accuracy" value={`${(curve[index] * 100).toFixed(1)}%`} />
          <Readout label="Gained by the last doubling" value={index === 0 ? "–" : `${gain >= 0 ? "+" : ""}${(gain * 100).toFixed(1)} pts`} tone={gain > 0.02 ? "pos" : index > 0 ? "neg" : undefined} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Accuracy as the amount of training data grows, with and without label noise" />
      <p className="label pointer-events-none absolute right-4 top-3">white = your data · grey = the same amount with perfect labels</p>
    </Frame>
  );
}

const RAW = [
  { q: "hi how do i change my delivery address", a: "Go to Orders, pick the order, then Edit address. This works until it ships." },
  { q: "refund??", a: "Refunds are available within 30 days with a receipt." },
];

export function Format() {
  const [style, setStyle] = useState<"raw notes" | "instruction pairs" | "chat messages">("raw notes");
  const text = RAW.map(({ q, a }) => {
    if (style === "raw notes") return `${q}  ->  ${a}`;
    if (style === "instruction pairs") return JSON.stringify({ instruction: q, response: a });
    return JSON.stringify({ messages: [{ role: "system", content: "You are the shop's support assistant." }, { role: "user", content: q }, { role: "assistant", content: a }] }, null, 1);
  });
  const ready = style !== "raw notes";

  return (
    <Frame
      tall
      controls={
        <>
          <Choice label="Format" value={style} options={["raw notes", "instruction pairs", "chat messages"] as const} onChange={setStyle} />
          <Readout label="A trainer can read it" value={ready ? "Yes" : "No"} tone={ready ? "pos" : "neg"} />
          <span className="max-w-sm text-sm text-dim">
            {style === "raw notes" && "Fine for a person, but there is no reliable way for a program to tell question from answer."}
            {style === "instruction pairs" && "One JSON object per line. Enough for single question-and-answer tasks."}
            {style === "chat messages" && "The format chat models are trained on: a list of turns, each with a role. It must match what the model expects."}
          </span>
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-2 overflow-auto p-4">
        {text.map((line, i) => (
          <pre key={i} className={`whitespace-pre-wrap border bg-[#0c0c0c] px-3 py-2 font-mono text-xs ${ready ? "border-pos text-white/90" : "border-neg text-white/70"}`}>{line}</pre>
        ))}
      </div>
    </Frame>
  );
}

// ================================================================ CHAPTER 9
export function Batching() {
  const [batch, setBatch] = useState(1);
  const [arrivals, setArrivals] = useState(20);
  // Simple model: a batch costs a fixed setup time plus a little per request.
  const runTime = (b: number) => 0.2 + 0.02 * b;
  const throughput = (b: number) => b / runTime(b);
  const wait = (batch - 1) / 2 / arrivals; // average time spent waiting for the batch to fill
  const latency = wait + runTime(batch);
  const capacity = throughput(batch);

  const ref = useCanvas((ctx, w, h) => {
    const half = w / 2;
    const draw = (label: string, top: number, f: (b: number) => number) => {
      const p = plot(ctx, half, h, [1, 32], [0, top], { x: "batch size", y: label });
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let b = 1; b <= 32; b++) {
        if (b === 1) ctx.moveTo(p.px(b), p.py(Math.min(top, f(b))));
        else ctx.lineTo(p.px(b), p.py(Math.min(top, f(b))));
      }
      ctx.stroke();
      square(ctx, p.px(batch), p.py(Math.min(top, f(batch))), 11, POS);
    };
    draw("requests per second", 40, throughput);
    ctx.save();
    ctx.translate(half, 0);
    draw("seconds each user waits", 2, (b) => (b - 1) / 2 / arrivals + runTime(b));
    ctx.restore();
  }, [batch, arrivals]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Batch size" value={batch} min={1} max={32} step={1} onChange={setBatch} />
          <Slider label="Requests arriving per second" value={arrivals} min={2} max={40} step={1} onChange={setArrivals} />
          <Readout label="Server can handle" value={`${capacity.toFixed(1)} / s`} tone={capacity >= arrivals ? "pos" : "neg"} />
          <Readout label="Each user waits" value={`${latency.toFixed(2)} s`} />
          <Readout label="Keeps up with demand" value={capacity >= arrivals ? "Yes" : "No, a queue builds"} tone={capacity >= arrivals ? "pos" : "neg"} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Throughput and waiting time as batch size changes" />
      <p className="label pointer-events-none absolute bottom-2 left-12">a simplified timing model, not a benchmark</p>
    </Frame>
  );
}

const MATRIX = (() => {
  const r = rng(202);
  return Array.from({ length: 256 }, () => r.normal());
})();
const SORTED_MAGNITUDES = MATRIX.map(Math.abs).sort((a, b) => a - b);

export function Pruning() {
  const [percent, setPercent] = useState(0);
  const cut = percent === 0 ? -1 : SORTED_MAGNITUDES[Math.min(255, Math.floor((percent / 100) * 256) - 1)];
  const kept = MATRIX.filter((v) => Math.abs(v) > cut);
  const strength = kept.reduce((s, v) => s + Math.abs(v), 0) / MATRIX.reduce((s, v) => s + Math.abs(v), 0);

  return (
    <Frame
      controls={
        <>
          <Slider label="Remove the smallest weights" value={percent} min={0} max={95} step={5} onChange={setPercent} format={(v) => `${v}%`} />
          <Readout label="Weights left" value={`${kept.length} of 256`} />
          <Readout label="Share of total weight strength kept" value={`${Math.round(strength * 100)}%`} tone={strength > 0.8 ? "pos" : strength < 0.5 ? "neg" : undefined} />
        </>
      }
    >
      <div className="flex h-full items-center justify-center p-3">
        <div className="grid grid-cols-[repeat(16,1fr)] gap-px" role="img" aria-label="A 16 by 16 weight matrix with small weights removed">
          {MATRIX.map((v, i) => {
            const gone = Math.abs(v) <= cut;
            const size = gone ? 3 : 4 + Math.min(1, Math.abs(v) / 2.2) * 13;
            return (
              <span key={i} className="grid h-[18px] w-[18px] place-items-center">
                <span style={{ width: size, height: size, background: gone ? "#2a2a2a" : v >= 0 ? "#fff" : NEG }} />
              </span>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

const ANIMALS = ["cat", "lynx", "dog", "fox", "truck"];
const TEACHER_LOGITS = [6, 4.2, 2.6, 2.2, -2];

export function Distill() {
  const [temperature, setTemperature] = useState(1);
  const soft = useMemo(() => {
    const e = TEACHER_LOGITS.map((l) => Math.exp((l - 6) / temperature));
    const total = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / total);
  }, [temperature]);
  const row = (label: string, values: number[], color: string) => (
    <div>
      <p className="label mb-1">{label}</p>
      {ANIMALS.map((name, i) => (
        <div key={name} className="flex items-center gap-3">
          <span className="w-12 text-right font-mono text-sm">{name}</span>
          <span className="h-4 flex-1"><span className="block h-full" style={{ width: `${values[i] * 100}%`, minWidth: values[i] > 0 ? 2 : 0, background: color }} /></span>
          <span className="w-14 text-right font-mono text-xs tabular-nums text-dim">{(values[i] * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );

  return (
    <Frame
      tall
      controls={
        <>
          <Slider label="Temperature used when teaching" value={temperature} min={0.5} max={6} step={0.1} onChange={setTemperature} format={(v) => v.toFixed(1)} />
          <Readout label="What the small model learns about “lynx”" value={`${(soft[1] * 100).toFixed(1)}%`} tone={soft[1] > 0.1 ? "pos" : undefined} />
          <Readout label="From the plain label" value="0%" />
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-5 px-5">
        {row("Plain label for this photo: only the right answer", [1, 0, 0, 0, 0], "#8f8f8f")}
        {row("The large model's full opinion, which the small model copies", soft, "#7cffb2")}
        <p className="text-sm text-dim">The large model also says which wrong answers are nearly right. That extra signal is what makes distillation work.</p>
      </div>
    </Frame>
  );
}

// ================================================================ CHAPTER 10
const PARTS = [
  { name: "Model", adds: "The starting point: a question goes in, an answer comes out.", cost: "Nothing extra." },
  { name: "Context", adds: "Retrieval and tools give the model the facts it needs for this question.", cost: "A search system to build and keep fresh." },
  { name: "Guardrails", adds: "Checks on the way in (private data, attacks) and on the way out (unsafe or broken answers).", cost: "Extra delay on every request." },
  { name: "Router and gateway", adds: "Sends easy questions to a cheap model and hard ones to a strong one, behind one entry point.", cost: "More moving parts to monitor." },
  { name: "Cache", adds: "Stores answers so repeated questions are instant and free.", cost: "Risk of serving a stale or mismatched answer." },
  { name: "Agent patterns", adds: "Lets the system loop, plan and take actions instead of answering once.", cost: "Harder to predict, test and debug." },
];

export function Architecture() {
  const [step, setStep] = useState(0);
  const has = (n: number) => step >= n;
  const box = (label: string, on: boolean, fresh: boolean) => (
    <span className={`border px-2 py-2 text-center font-mono text-[11px] uppercase tracking-wider ${!on ? "border-line text-faint" : fresh ? "border-pos bg-pos text-black" : "border-white"}`}>{label}</span>
  );

  return (
    <Frame
      tall
      controls={
        <>
          <button className="btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◂ Remove</button>
          <button className="btn btn-solid" onClick={() => setStep((s) => Math.min(5, s + 1))} disabled={step === 5}>Add the next piece ▸</button>
          <Readout label="Pieces in the system" value={`${step + 1} of 6`} />
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-5 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {box("User", true, false)}
          <span className="text-dim">▸</span>
          {box("Cache", has(4), step === 4)}
          <span className="text-dim">▸</span>
          {box("Input checks", has(2), step === 2)}
          <span className="text-dim">▸</span>
          {box("Context", has(1), step === 1)}
          <span className="text-dim">▸</span>
          {box("Router", has(3), step === 3)}
          <span className="text-dim">▸</span>
          {box(has(5) ? "Model ⟲ tools" : "Model", true, step === 0 || step === 5)}
          <span className="text-dim">▸</span>
          {box("Output checks", has(2), step === 2)}
          <span className="text-dim">▸</span>
          {box("Answer", true, false)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
          <div>
            <p className="label text-pos">Step {step}: {PARTS[step].name}</p>
            <p className="mt-1 text-lg text-white/90">{PARTS[step].adds}</p>
          </div>
          <div>
            <p className="label text-neg">What it costs</p>
            <p className="mt-1 text-lg text-white/90">{PARTS[step].cost}</p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

const QUERIES = [
  "What are your opening hours?",
  "What are your opening hours?",
  "what are your opening hours today",
  "How do I reset my password?",
  "How can I reset my password?",
  "What are your closing hours?",
  "How do I delete my account?",
  "How do I reset my router?",
];
// pairs that look alike but need different answers
const DIFFERENT = new Set(["5-0", "5-1", "5-2", "7-3", "7-4"]);

export function Cache() {
  const [kind, setKind] = useState<"exact match" | "similar meaning">("exact match");
  const [threshold, setThreshold] = useState(0.7);
  const result = useMemo(() => {
    const stored: number[] = [];
    return QUERIES.map((q, i) => {
      const hit = stored.find((s) => (kind === "exact match" ? QUERIES[s] === q : jaccard(QUERIES[s], q) >= threshold));
      if (hit === undefined) {
        stored.push(i);
        return { hit: null as number | null, wrong: false };
      }
      return { hit, wrong: DIFFERENT.has(`${i}-${hit}`) };
    });
  }, [kind, threshold]);
  const hits = result.filter((r) => r.hit !== null).length;
  const wrong = result.filter((r) => r.wrong).length;

  return (
    <Frame
      tall
      controls={
        <>
          <Choice label="Cache type" value={kind} options={["exact match", "similar meaning"] as const} onChange={setKind} />
          {kind === "similar meaning" && <Slider label="How similar counts as the same" value={threshold} min={0.3} max={1} step={0.05} onChange={setThreshold} format={(v) => `${Math.round(v * 100)}%`} />}
          <Readout label="Model calls saved" value={`${hits} of ${QUERIES.length}`} tone="pos" />
          <Readout label="Wrong answer served" value={String(wrong)} tone={wrong ? "neg" : "pos"} />
        </>
      }
    >
      <ol className="flex h-full flex-col justify-center gap-1 overflow-auto p-4">
        {QUERIES.map((q, i) => {
          const r = result[i];
          return (
            <li key={i} className={`flex items-center justify-between gap-3 border px-3 py-1.5 text-sm ${r.wrong ? "border-neg" : r.hit !== null ? "border-pos" : "border-line"}`}>
              <span><span className="mr-2 font-mono text-xs text-dim">{i + 1}</span>{q}</span>
              <span className={`shrink-0 font-mono text-[11px] ${r.wrong ? "text-neg" : r.hit !== null ? "text-pos" : "text-dim"}`}>
                {r.hit === null ? "asked the model" : r.wrong ? `reused answer ${r.hit + 1}: wrong` : `reused answer ${r.hit + 1}`}
              </span>
            </li>
          );
        })}
        <li className="label mt-1 list-none">Similarity here is shared words. Real semantic caches compare embeddings, with the same risk.</li>
      </ol>
    </Frame>
  );
}

const SIGNALS = [
  { act: "Copies the answer", means: "positive", why: "They found it useful enough to take away." },
  { act: "Presses regenerate", means: "negative", why: "The first answer was not good enough." },
  { act: "Stops the answer halfway", means: "negative", why: "It was going wrong, or far too long." },
  { act: "Rewrites their question", means: "negative", why: "The model misunderstood the first time." },
  { act: "Says “thanks” and leaves", means: "positive", why: "The task was probably finished." },
  { act: "Edits the model's text", means: "mixed", why: "Close but not right. The edit itself shows what they wanted." },
];

export function Feedback() {
  const [open, setOpen] = useState<number[]>([]);
  const toggle = (i: number) => setOpen((o) => (o.includes(i) ? o : [...o, i]));
  return (
    <Frame
      tall
      controls={
        <>
          <Readout label="Signals revealed" value={`${open.length} of ${SIGNALS.length}`} />
          <button className="btn btn-quiet" onClick={() => setOpen([])}>Hide all</button>
          <span className="max-w-sm text-sm text-dim">Few users press thumbs up or down. Most feedback is hidden in what they do next.</span>
        </>
      }
    >
      <div className="grid h-full content-center gap-2 p-4 sm:grid-cols-2">
        {SIGNALS.map((s, i) => {
          const shown = open.includes(i);
          const tone = s.means === "positive" ? "border-pos" : s.means === "negative" ? "border-neg" : "border-[#ffd166]";
          return (
            <button key={s.act} onClick={() => toggle(i)} className={`border p-3 text-left ${shown ? tone : "border-line hover:border-white"}`}>
              <p className="text-sm">The user: <b>{s.act}</b></p>
              <p className={`mt-1 text-sm ${shown ? "text-white/80" : "text-dim"}`}>
                {shown ? <><span className="label mr-2">{s.means}</span>{s.why}</> : "Good sign or bad? Click to check."}
              </p>
            </button>
          );
        })}
      </div>
    </Frame>
  );
}


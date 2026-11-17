"use client";

import { useEffect, useMemo, useState } from "react";
import { fitPolynomial, rmse } from "./homl4";
import { Choice, Frame, POS, Readout, plot, rng, square, useCanvas } from "./ui";

// ---------------------------------------------------------------- 1. the project map
const STAGES = [
  { name: "Frame the problem", does: "Decide what is being predicted, who uses the answer, and how success is measured.", skip: "You build an accurate model for the wrong question." },
  { name: "Get the data", does: "Collect it, load it, and set a test set aside before looking closely.", skip: "You peek at the test data and fool yourself about how good the model is." },
  { name: "Explore the data", does: "Plot it. Look for patterns, odd values and features that move together.", skip: "You miss a broken column or an obvious clue the model needed." },
  { name: "Prepare the data", does: "Fill gaps, turn categories into numbers, put features on similar scales.", skip: "The algorithm crashes on missing values or lets one big-numbered feature dominate." },
  { name: "Shortlist models", does: "Try several quick models and compare them with cross-validation.", skip: "You spend days tuning a model that a simpler one would have beaten." },
  { name: "Fine-tune", does: "Search the settings of the best candidates, then check once on the test set.", skip: "You ship default settings and leave easy accuracy on the table." },
  { name: "Present the solution", does: "Explain what you found, what the model can and cannot do, and what it assumed.", skip: "Nobody trusts or understands the result, so it is not used." },
  { name: "Launch and monitor", does: "Deploy it, watch its live performance, and retrain when the world drifts.", skip: "The model quietly gets worse and no one notices." },
];

export function ProjectMap() {
  const [active, setActive] = useState(0);
  const stage = STAGES[active];
  return (
    <Frame
      controls={
        <>
          <button className="btn" onClick={() => setActive((a) => Math.max(0, a - 1))} disabled={active === 0}>◂ Previous step</button>
          <button className="btn btn-solid" onClick={() => setActive((a) => Math.min(STAGES.length - 1, a + 1))} disabled={active === STAGES.length - 1}>Next step ▸</button>
          <Readout label="Step" value={`${active + 1} of ${STAGES.length}`} />
        </>
      }
    >
      <div className="flex h-full flex-col justify-center gap-6 p-5">
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {STAGES.map((s, i) => (
            <li key={s.name}>
              <button
                onClick={() => setActive(i)}
                aria-current={i === active ? "step" : undefined}
                className={`flex h-full w-full flex-col gap-1 border p-2 text-left ${
                  i === active ? "border-white bg-white text-black" : i < active ? "border-white/50 text-white" : "border-line text-dim hover:border-white"
                }`}
              >
                <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-xs leading-tight">{s.name}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
          <div>
            <p className="label text-pos">What you do</p>
            <p className="mt-1 text-lg text-white/90">{stage.does}</p>
          </div>
          <div>
            <p className="label text-neg">If you skip it</p>
            <p className="mt-1 text-lg text-white/90">{stage.skip}</p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. messy table
type Row = { rooms: number; income: number | null; place: "inland" | "near bay" | "near ocean" };
const ROWS: Row[] = [
  { rooms: 880, income: 8.3, place: "near bay" },
  { rooms: 7099, income: 8.3, place: "near bay" },
  { rooms: 1467, income: null, place: "inland" },
  { rooms: 1274, income: 5.6, place: "near ocean" },
  { rooms: 2535, income: 3.8, place: "inland" },
  { rooms: 919, income: null, place: "near ocean" },
];
const PLACES = ["inland", "near bay", "near ocean"] as const;

export function CleanTable() {
  const [gaps, setGaps] = useState<"leave" | "fill with median">("leave");
  const [categories, setCategories] = useState<"as text" | "one-hot">("as text");
  const [scale, setScale] = useState<"raw" | "standardized">("raw");

  const known = ROWS.map((r) => r.income).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const median = (known[known.length / 2 - 1] + known[known.length / 2]) / 2;
  const filled = ROWS.map((r) => ({ ...r, income: r.income ?? (gaps === "leave" ? null : median), wasMissing: r.income === null }));
  const standardize = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v !== null);
    const mean = present.reduce((a, b) => a + b, 0) / present.length;
    const sd = Math.sqrt(present.reduce((s, v) => s + (v - mean) ** 2, 0) / present.length) || 1;
    return values.map((v) => (v === null ? null : (v - mean) / sd));
  };
  const rooms = scale === "raw" ? filled.map((r) => r.rooms) : standardize(filled.map((r) => r.rooms));
  const income = scale === "raw" ? filled.map((r) => r.income) : standardize(filled.map((r) => r.income));
  const ready = gaps !== "leave" && categories === "one-hot" && scale === "standardized";
  const show = (v: number | null) => (v === null ? "missing" : scale === "raw" ? String(v) : v.toFixed(2));
  const th = "border border-line px-3 py-1.5 text-left font-mono text-[11px] uppercase tracking-wider text-dim";
  const td = "border border-line px-3 py-1.5 font-mono text-sm tabular-nums";

  return (
    <Frame
      controls={
        <>
          <Choice label="Missing values" value={gaps} options={["leave", "fill with median"] as const} onChange={setGaps} />
          <Choice label="Categories" value={categories} options={["as text", "one-hot"] as const} onChange={setCategories} />
          <Choice label="Number scale" value={scale} options={["raw", "standardized"] as const} onChange={setScale} />
          <Readout label="Ready for a model" value={ready ? "Yes" : "Not yet"} tone={ready ? "pos" : "neg"} />
        </>
      }
    >
      <div className="flex h-full items-center justify-center overflow-auto p-4">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className={th}>rooms</th>
              <th className={th}>income</th>
              {categories === "as text" ? <th className={th}>location</th> : PLACES.map((p) => <th key={p} className={th}>{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {filled.map((row, i) => (
              <tr key={i}>
                <td className={td}>{show(rooms[i])}</td>
                <td className={`${td} ${income[i] === null ? "bg-neg/20 text-neg" : row.wasMissing ? "text-pos" : ""}`}>{show(income[i])}</td>
                {categories === "as text" ? (
                  <td className={`${td} text-neg`}>{row.place}</td>
                ) : (
                  PLACES.map((p) => <td key={p} className={`${td} ${row.place === p ? "text-pos" : "text-faint"}`}>{row.place === p ? 1 : 0}</td>)
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="label pointer-events-none absolute bottom-2 left-3">red = a model cannot use this yet · green = fixed</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. feature scaling
const DISTRICTS = (() => {
  const r = rng(52);
  return Array.from({ length: 36 }, () => ({ income: 1 + r.next() * 13, people: 200 + r.next() * 2800 }));
})();

export function Scaling() {
  const [mode, setMode] = useState<"raw" | "min-max" | "standardized">("raw");
  const scaled = useMemo(() => {
    const column = (values: number[]) => {
      if (mode === "raw") return values;
      const lo = Math.min(...values), hi = Math.max(...values);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
      return values.map((v) => (mode === "min-max" ? (v - lo) / (hi - lo) : (v - mean) / sd));
    };
    const a = column(DISTRICTS.map((d) => d.income));
    const b = column(DISTRICTS.map((d) => d.people));
    return a.map((x, i) => ({ x, y: b[i] }));
  }, [mode]);

  // nearest neighbour of district 0, using straight-line distance in the current scaling
  let nearest = 1;
  for (let i = 2; i < scaled.length; i++) {
    const d = (p: { x: number; y: number }) => (p.x - scaled[0].x) ** 2 + (p.y - scaled[0].y) ** 2;
    if (d(scaled[i]) < d(scaled[nearest])) nearest = i;
  }
  // how much of all the distance between districts comes from income (its share of the total spread)
  const spread = (values: number[]) => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((t, v) => t + (v - mean) ** 2, 0);
  };
  const sx = spread(scaled.map((d) => d.x));
  const sy = spread(scaled.map((d) => d.y));
  const incomeShare = sx / (sx + sy || 1);
  const range: [number, number] = mode === "raw" ? [0, 3000] : mode === "min-max" ? [0, 1] : [-2.5, 2.5];

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, range, range, { x: "income (same ruler as population)", y: "population" });
    ctx.strokeStyle = POS;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.px(scaled[0].x), p.py(scaled[0].y));
    ctx.lineTo(p.px(scaled[nearest].x), p.py(scaled[nearest].y));
    ctx.stroke();
    scaled.forEach((d, i) => square(ctx, p.px(d.x), p.py(d.y), i === 0 ? 12 : 6, i === 0 || i === nearest ? POS : "#fff", i === 0));
  }, [scaled, nearest, mode]);

  return (
    <Frame
      controls={
        <>
          <Choice label="Scaling" value={mode} options={["raw", "min-max", "standardized"] as const} onChange={setMode} />
          <Readout label="Most similar district" value={`#${nearest}`} tone="pos" />
          <Readout label="Income's share of all distances" value={incomeShare < 0.001 ? "under 0.1%" : `${(incomeShare * 100).toFixed(0)}%`} tone={incomeShare < 0.02 ? "neg" : "pos"} />
          <span className="max-w-xs text-sm text-dim">Income runs 1 to 14, population 200 to 3,000. Both axes use one ruler, as a distance-based model sees them.</span>
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Two features before and after scaling, with one point's nearest neighbour" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 4. hyperparameter search
const SEARCH_DATA = (() => {
  const r = rng(71);
  return Array.from({ length: 45 }, () => {
    const x = r.next() * 6 - 3;
    return { x, y: 0.5 * x * x + x + 2 + r.normal() * 1.1 };
  });
})();
const DEGREES = Array.from({ length: 10 }, (_, i) => i + 1);
const ALPHAS = [0, 0.0001, 0.001, 0.01, 0.1, 1];

/** Real 3-fold cross-validation score for one combination of settings. */
function crossValidate(degree: number, alpha: number) {
  let total = 0;
  for (let fold = 0; fold < 3; fold++) {
    const train = SEARCH_DATA.filter((_, i) => i % 3 !== fold);
    const held = SEARCH_DATA.filter((_, i) => i % 3 === fold);
    total += Math.min(9, rmse(fitPolynomial(train, degree, alpha), held));
  }
  return total / 3;
}
const SCORES = ALPHAS.map((alpha) => DEGREES.map((degree) => crossValidate(degree, alpha)));
const BEST_SCORE = Math.min(...SCORES.flat());

export function GridSearch() {
  const [mode, setMode] = useState<"grid search" | "random search">("grid search");
  const [run, setRun] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const order = useMemo(() => {
    const cells = ALPHAS.flatMap((_, a) => DEGREES.map((_, d) => [a, d] as [number, number]));
    if (mode === "grid search") return cells;
    const r = rng(run * 53 + 7);
    return cells.map((c) => ({ c, k: r.next() })).sort((a, b) => a.k - b.k).slice(0, 12).map((o) => o.c);
  }, [mode, run]);

  useEffect(() => {
    if (run === 0) return;
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      setRevealed(n);
      if (n >= order.length) clearInterval(timer);
    }, mode === "grid search" ? 45 : 160);
    return () => clearInterval(timer);
  }, [run, order, mode]);

  const seen = order.slice(0, run === 0 ? 0 : revealed);
  const best = seen.reduce<[number, number] | null>((b, c) => (!b || SCORES[c[0]][c[1]] < SCORES[b[0]][b[1]] ? c : b), null);

  return (
    <Frame
      tall
      controls={
        <>
          <Choice label="Strategy" value={mode} options={["grid search", "random search"] as const} onChange={(m) => { setMode(m); setRun(0); setRevealed(0); }} />
          <button className="btn btn-solid" onClick={() => { setRevealed(0); setRun((r) => r + 1); }}>▶ Run the search</button>
          <Readout label="Models trained" value={`${seen.length * 3}`} />
          <Readout label="Best error found" value={best ? SCORES[best[0]][best[1]].toFixed(3) : "–"} tone={best && SCORES[best[0]][best[1]] < BEST_SCORE * 1.03 ? "pos" : undefined} />
          <Readout label="Best possible" value={BEST_SCORE.toFixed(3)} />
        </>
      }
    >
      <div className="mx-auto flex h-full max-w-2xl flex-col justify-center p-4">
        <p className="label mb-1 pl-16 text-center">polynomial degree ▸</p>
        <div className="grid grid-cols-[4rem_repeat(10,1fr)] gap-1">
          <span />
          {DEGREES.map((d) => <span key={d} className="text-center font-mono text-[11px] text-dim">{d}</span>)}
          {ALPHAS.map((alpha, a) => (
            <div key={alpha} className="contents">
              <span className="self-center font-mono text-[11px] text-dim">α {alpha}</span>
              {DEGREES.map((_, d) => {
                const tried = seen.some((c) => c[0] === a && c[1] === d);
                const quality = Math.max(0, 1 - (SCORES[a][d] - BEST_SCORE) / 1.2);
                const isBest = best !== null && best[0] === a && best[1] === d;
                return (
                  <div key={d} className={`grid aspect-[4/3] place-items-center border ${isBest ? "border-pos" : "border-line"}`} title={tried ? `error ${SCORES[a][d].toFixed(3)}` : "not tried"}>
                    {tried && <span style={{ width: `${20 + quality * 70}%`, height: `${20 + quality * 70}%`, background: isBest ? POS : "#fff", opacity: 0.25 + quality * 0.75 }} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="label mt-2">bigger and brighter = lower cross-validation error · each square = 3 models trained · green = best so far</p>
      </div>
    </Frame>
  );
}

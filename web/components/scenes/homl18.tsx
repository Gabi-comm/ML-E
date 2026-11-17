"use client";

import { useMemo, useState } from "react";
import { DIM, Frame, NEG, POS, Readout, Slider, plot, rng, square, useCanvas } from "./ui";

// ---------------------------------------------------------------- 1. Q-learning in a grid world
const N = 5;
const GOAL = 4, PIT = 9; // cell indexes: top-right is the goal, the cell below it is the pit
const WALLS = new Set([6, 11, 13]);
const START = 20;
const MOVES = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
const ARROWS = ["▲", "▶", "▼", "◀"];

function move(cell: number, action: number) {
  const x = (cell % N) + MOVES[action][0], y = Math.floor(cell / N) + MOVES[action][1];
  const next = x < 0 || y < 0 || x >= N || y >= N || WALLS.has(y * N + x) ? cell : y * N + x;
  const reward = next === GOAL ? 1 : next === PIT ? -1 : -0.02;
  return { next, reward, done: next === GOAL || next === PIT };
}

/** Standard Q-learning for a number of episodes. Deterministic for a given seed. */
function learn(episodes: number, epsilon: number, gamma: number) {
  const r = rng(7);
  const q = Array.from({ length: N * N }, () => [0, 0, 0, 0]);
  for (let e = 0; e < episodes; e++) {
    let cell = START;
    for (let step = 0; step < 60; step++) {
      const action = r.next() < epsilon ? Math.floor(r.next() * 4) : q[cell].indexOf(Math.max(...q[cell]));
      const { next, reward, done } = move(cell, action);
      q[cell][action] += 0.3 * (reward + (done ? 0 : gamma * Math.max(...q[next])) - q[cell][action]);
      cell = next;
      if (done) break;
    }
  }
  return q;
}

function greedyPath(q: number[][]) {
  const path = [START];
  let cell = START;
  for (let step = 0; step < 30; step++) {
    const { next, done } = move(cell, q[cell].indexOf(Math.max(...q[cell])));
    if (next === cell) break;
    path.push(next);
    cell = next;
    if (done) break;
  }
  return path;
}

export function GridWorld() {
  const [episodes, setEpisodes] = useState(0);
  const [percent, setPercent] = useState(20);
  const [gamma, setGamma] = useState(0.9);
  const q = useMemo(() => learn(episodes, percent / 100, gamma), [episodes, percent, gamma]);
  const path = useMemo(() => greedyPath(q), [q]);
  const reached = path[path.length - 1] === GOAL;

  return (
    <Frame
      tall
      controls={
        <>
          <button className="btn" onClick={() => setEpisodes((e) => e + 1)}>+1 episode</button>
          <button className="btn btn-solid" onClick={() => setEpisodes((e) => e + 50)}>+50 episodes</button>
          <button className="btn btn-quiet" onClick={() => setEpisodes(0)}>Reset</button>
          <Slider label="Explore at random" value={percent} min={0} max={60} step={5} onChange={setPercent} format={(v) => `${v}%`} />
          <Slider label="Discount γ" value={gamma} min={0.5} max={0.99} step={0.01} onChange={setGamma} format={(v) => v.toFixed(2)} />
          <Readout label="Episodes played" value={String(episodes)} />
          <Readout label="Best-known route" value={reached ? `${path.length - 1} moves to goal` : "does not reach goal"} tone={reached ? "pos" : "neg"} />
        </>
      }
    >
      <div className="flex h-full items-center justify-center p-3">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 4.2rem))` }}>
          {Array.from({ length: N * N }, (_, cell) => {
            const value = Math.max(...q[cell]);
            const best = q[cell].indexOf(value);
            const wall = WALLS.has(cell);
            const onPath = path.includes(cell);
            const shade = value >= 0 ? `rgba(124,255,178,${Math.min(0.85, value * 0.9)})` : `rgba(255,92,122,${Math.min(0.85, -value * 0.9)})`;
            return (
              <div
                key={cell}
                className={`relative grid aspect-square place-items-center border font-mono ${onPath && !wall ? "border-white" : "border-line"}`}
                style={{ background: wall ? "#1c1c1c" : cell === GOAL ? POS : cell === PIT ? NEG : shade }}
              >
                {wall ? null : cell === GOAL ? (
                  <span className="text-xs font-semibold text-black">GOAL +1</span>
                ) : cell === PIT ? (
                  <span className="text-xs font-semibold text-black">PIT −1</span>
                ) : (
                  <>
                    <span className="text-lg">{q[cell].every((v) => v === 0) ? "·" : ARROWS[best]}</span>
                    <span className="absolute bottom-0.5 right-1 text-[10px] text-white/70">{value.toFixed(2)}</span>
                    {cell === START && <span className="absolute left-1 top-0.5 text-[10px] text-white/80">START</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 2. discounting the future
export function Discount() {
  const [gamma, setGamma] = useState(0.9);
  const soon = { reward: 4, at: 2 }, late = { reward: 10, at: 12 };
  const worth = (o: { reward: number; at: number }) => o.reward * Math.pow(gamma, o.at);
  const prefers = worth(soon) > worth(late) ? "the small reward soon" : "the big reward later";

  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, 15], [0, 1], { x: "steps into the future", y: "what a reward of 1 is worth today" });
    const bar = ((p.right - p.left) / 15) * 0.55;
    for (let t = 0; t <= 15; t++) {
      const v = Math.pow(gamma, t);
      ctx.fillStyle = t === soon.at || t === late.at ? POS : "#fff";
      ctx.fillRect(p.px(t) - bar / 2, p.py(v), bar, p.bottom - p.py(v));
    }
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = DIM;
    ctx.textAlign = "center";
    ctx.fillText("reward 4", p.px(soon.at), p.top + 10);
    ctx.fillText("reward 10", p.px(late.at), p.top + 10);
  }, [gamma]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Discount factor γ" value={gamma} min={0.5} max={0.99} step={0.01} onChange={setGamma} format={(v) => v.toFixed(2)} />
          <Readout label="4 points in 2 steps, worth now" value={worth(soon).toFixed(2)} />
          <Readout label="10 points in 12 steps, worth now" value={worth(late).toFixed(2)} />
          <Readout label="The agent prefers" value={prefers} tone="pos" />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="How much a future reward is worth today for a given discount factor" />
    </Frame>
  );
}

// ---------------------------------------------------------------- 3. explore or exploit
const PAYOUTS = [0.25, 0.45, 0.6, 0.35];
const PULLS = 600;

function playBandit(epsilon: number, seed: number) {
  const r = rng(seed * 911 + 3);
  const counts = [0, 0, 0, 0], estimates = [0, 0, 0, 0];
  const average: number[] = [];
  let total = 0;
  for (let t = 1; t <= PULLS; t++) {
    const arm = r.next() < epsilon ? Math.floor(r.next() * 4) : estimates.indexOf(Math.max(...estimates));
    const reward = r.next() < PAYOUTS[arm] ? 1 : 0;
    counts[arm] += 1;
    estimates[arm] += (reward - estimates[arm]) / counts[arm];
    total += reward;
    average.push(total / t);
  }
  return { counts, estimates, average };
}

export function Bandit() {
  const [percent, setPercent] = useState(10);
  const [seed, setSeed] = useState(1);
  const run = useMemo(() => playBandit(percent / 100, seed), [percent, seed]);
  const final = run.average[PULLS - 1];
  const favourite = run.counts.indexOf(Math.max(...run.counts));

  const ref = useCanvas((ctx, w, h) => {
    const split = w * 0.62;
    const p = plot(ctx, split, h, [0, PULLS], [0, 0.8], { x: "pulls", y: "average payout so far" });
    ctx.strokeStyle = "#444";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.left, p.py(0.6));
    ctx.lineTo(p.right, p.py(0.6));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    run.average.forEach((v, i) => (i ? ctx.lineTo(p.px(i + 1), p.py(Math.min(0.8, v))) : ctx.moveTo(p.px(1), p.py(Math.min(0.8, v)))));
    ctx.stroke();
    ctx.save();
    ctx.translate(split, 0);
    const q = plot(ctx, w - split, h, [0.5, 4.5], [0, 0.8], { x: "machine 1 to 4", y: "" });
    const bar = ((q.right - q.left) / 4) * 0.3;
    PAYOUTS.forEach((truth, i) => {
      ctx.fillStyle = "#555";
      ctx.fillRect(q.px(i + 1) - bar - 1, q.py(truth), bar, q.bottom - q.py(truth));
      ctx.fillStyle = i === favourite ? POS : "#fff";
      ctx.fillRect(q.px(i + 1) + 1, q.py(run.estimates[i]), bar, q.bottom - q.py(run.estimates[i]));
      square(ctx, q.px(i + 1), q.top + 8, 2 + Math.sqrt(run.counts[i]) * 0.6, i === favourite ? POS : "#fff");
    });
    ctx.restore();
  }, [run]);

  return (
    <Frame
      controls={
        <>
          <Slider label="Explore at random" value={percent} min={0} max={50} step={1} onChange={setPercent} format={(v) => `${v}%`} />
          <button className="btn" onClick={() => setSeed((s) => s + 1)}>Play another 600 pulls</button>
          <Readout label="Average payout" value={final.toFixed(3)} tone={final > 0.55 ? "pos" : final < 0.45 ? "neg" : undefined} />
          <Readout label="Best possible" value="0.600" />
          <Readout label="Machine it settled on" value={`#${favourite + 1}`} tone={favourite === 2 ? "pos" : "neg"} />
        </>
      }
    >
      <canvas ref={ref} className="h-full w-full" role="img" aria-label="Average reward over time and estimated value of each slot machine" />
      <p className="label pointer-events-none absolute right-4 top-3">grey = true payout · white = agent&apos;s estimate · top squares = how often it played</p>
    </Frame>
  );
}

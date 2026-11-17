"use client";

import { useState } from "react";
import type { Lesson } from "@/lib/lessons";
import type { CheckResult } from "@/lib/tutor";
import Rich from "./Rich";

type Progress = { step: number; done: number[] };

const key = (id: string) => `mle:lesson:${id}`;

function load(lesson: Lesson): Progress {
  try {
    const saved = JSON.parse(localStorage.getItem(key(lesson.id)) ?? "null") as Progress | null;
    if (saved && Number.isInteger(saved.step) && Array.isArray(saved.done)) {
      return { step: Math.min(Math.max(0, saved.step), lesson.steps.length - 1), done: saved.done };
    }
  } catch {}
  return { step: 0, done: [] };
}

function save(id: string, progress: Progress) {
  try {
    localStorage.setItem(key(id), JSON.stringify(progress));
  } catch {}
}

/**
 * The step-by-step card above the editor. It never shows the full answer up front:
 * the task and the idea come first, hints open one at a time, and "Run & check" tests the code.
 */
export default function TaskPanel({
  lesson, canRun, onCheck, onAsk, onReset,
}: {
  lesson: Lesson;
  canRun: boolean;
  onCheck: (check: string) => Promise<CheckResult>;
  onAsk: (question: string) => void;
  onReset: () => void;
}) {
  const [progress, setProgress] = useState<Progress>(() => load(lesson));
  const [hints, setHints] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(true);
  const [showWhy, setShowWhy] = useState(false);

  const step = lesson.steps[progress.step];
  const finished = progress.done.length === lesson.steps.length;

  const update = (next: Progress) => {
    setProgress(next);
    save(lesson.id, next);
  };

  const go = (index: number) => {
    update({ ...progress, step: index });
    setHints(0);
    setResult(null);
    setShowWhy(false);
  };

  const check = async () => {
    setChecking(true);
    setResult(null);
    let outcome: CheckResult;
    try {
      outcome = await onCheck(step.check);
    } catch (e) {
      outcome = { ok: false, message: (e as Error).message, error: true };
    }
    setChecking(false);
    setResult(outcome);
    if (outcome.ok && !progress.done.includes(progress.step)) update({ ...progress, done: [...progress.done, progress.step] });
  };

  const restart = () => {
    if (!window.confirm("Start this lesson over? Your code for it is replaced with the starting code and progress is cleared.")) return;
    update({ step: 0, done: [] });
    setHints(0);
    setResult(null);
    onReset();
  };

  return (
    <div className="flex max-h-[45%] min-h-0 shrink-0 flex-col border-b border-line bg-panel">
      <div className="flex items-center gap-3 px-3 py-1.5">
        <button className="label hover:text-white" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "▾" : "▸"} Step {progress.step + 1} of {lesson.steps.length}
        </button>
        <ol className="flex gap-1" aria-label="Steps">
          {lesson.steps.map((s, i) => (
            <li key={s.title}>
              <button
                onClick={() => go(i)} title={`${i + 1}. ${s.title}${progress.done.includes(i) ? " (done)" : ""}`}
                aria-current={i === progress.step ? "step" : undefined}
                className={`block h-3 w-3 border ${progress.done.includes(i) ? "border-pos bg-pos" : "border-faint"} ${i === progress.step ? "outline outline-1 outline-offset-2 outline-white" : ""}`}
              >
                <span className="sr-only">Step {i + 1}</span>
              </button>
            </li>
          ))}
        </ol>
        <span className="truncate font-mono text-sm">{step.title}</span>
        <button className="label ml-auto shrink-0 hover:text-white" onClick={restart}>Start over</button>
      </div>

      {open && (
        <div className="min-h-0 overflow-y-auto px-3 pb-3 text-sm">
          {finished && progress.step === lesson.steps.length - 1 && result?.ok && (
            <p className="mb-2 border border-pos p-2 text-pos">Lesson complete. Pick the next lesson from the menu above, or keep experimenting with this code.</p>
          )}
          <Rich text={step.task} className="text-white" />
          <button className="label mt-2 hover:text-white" onClick={() => setShowWhy(!showWhy)} aria-expanded={showWhy}>
            {showWhy ? "▾" : "▸"} Why this matters
          </button>
          {showWhy && <Rich text={step.why} className="mt-1 text-white/75" />}

          {step.hints.slice(0, hints).map((hint, i) => (
            <div key={i} className="mt-2 border-l border-faint pl-3 text-white/85">
              <span className="label">{i === step.hints.length - 1 && step.hints.length > 1 ? "The line" : `Hint ${i + 1}`}</span>
              <Rich text={hint} />
            </div>
          ))}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn btn-solid" onClick={check} disabled={!canRun || checking}>{checking ? "Checking…" : "▶ Run & check"}</button>
            {hints < step.hints.length && (
              <button className="btn" onClick={() => setHints(hints + 1)}>
                {hints === step.hints.length - 1 && step.hints.length > 1 ? "Show me the line" : hints === 0 ? "Give me a hint" : "Another hint"}
              </button>
            )}
            <button className="btn btn-quiet" onClick={() => onAsk(`I'm on step ${progress.step + 1}, "${step.title}". Can you explain the idea behind it?`)}>Ask about this step</button>
          </div>

          {result && (
            <div className={`mt-3 border p-2 ${result.ok ? "border-pos text-pos" : "border-neg text-white"}`} role="status">
              <p>{result.ok ? "✓ " : "✗ "}{result.message}</p>
              {result.ok && progress.step < lesson.steps.length - 1 && (
                <button className="btn btn-solid mt-2" onClick={() => go(progress.step + 1)}>Next step ▸</button>
              )}
              {!result.ok && (
                <button className="btn btn-quiet mt-2" onClick={() => onAsk(result.error
                  ? "My code stopped with an error. What does the error mean, and where should I look?"
                  : `My check for "${step.title}" says: ${result.message} What am I missing?`)}
                >
                  Ask about this
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

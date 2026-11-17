"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SCENES, type Quiz } from "@/lib/scenes";

export const LAB_HANDOFF = "mle:lab-code";
const SEEN = "mle:seen";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? "[]");
  } catch {
    return [];
  }
}

function QuizCard({ quiz }: { quiz: Quiz }) {
  const [choice, setChoice] = useState<number | null>(null);
  return (
    <div className="mx-auto flex min-h-[22rem] max-w-2xl flex-col justify-center p-6">
      <p className="text-xl">{quiz.question}</p>
      <div className="mt-5 flex flex-col gap-2">
        {quiz.options.map((option, i) => {
          const picked = choice === i;
          const right = i === quiz.answer;
          const tone = choice === null ? "border-line hover:border-white" : right ? "border-pos text-pos" : picked ? "border-neg text-neg" : "border-line text-dim";
          return (
            <button key={option} onClick={() => setChoice(i)} disabled={choice !== null} className={`border px-4 py-3 text-left ${tone}`}>
              {option}
              {choice !== null && right && " ✓"}
              {picked && !right && " ✗"}
            </button>
          );
        })}
      </div>
      <p className="mt-5 min-h-12 text-white/80" aria-live="polite">
        {choice !== null && (
          <>
            <span className={choice === quiz.answer ? "text-pos" : "text-neg"}>{choice === quiz.answer ? "Correct. " : "Not quite. "}</span>
            {quiz.why}
          </>
        )}
      </p>
      {choice !== null && choice !== quiz.answer && (
        <button className="btn self-start" onClick={() => setChoice(null)}>Try again</button>
      )}
    </div>
  );
}

export default function ChapterPlayer({
  chapterKey, bookId, bookTitle, chapterNumber, chapterTitle, next,
}: {
  chapterKey: string; bookId: string; bookTitle: string; chapterNumber: number; chapterTitle: string; next: number | null;
}) {
  const { scenes, quiz } = SCENES[chapterKey];
  const steps = scenes.length + 1; // the last step is the check question
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  const router = useRouter();
  const scene = scenes[index];
  const id = `${chapterKey}:${scene ? scene.id : "quiz"}`;

  useEffect(() => {
    const all = readSeen();
    if (!all.includes(id)) {
      all.push(id);
      try {
        localStorage.setItem(SEEN, JSON.stringify(all));
      } catch {}
    }
    const frame = requestAnimationFrame(() => setSeen(all));
    return () => cancelAnimationFrame(frame);
  }, [id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (event.key === "ArrowRight") setIndex((i) => Math.min(steps - 1, i + 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps]);

  const openInLab = () => {
    if (!scene?.lab) return;
    try {
      sessionStorage.setItem(LAB_HANDOFF, scene.lab);
    } catch {}
    router.push("/lab");
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href="/books" className="label hover:text-white">◂ Books</Link>
        <p className="label">{bookTitle} · Chapter {chapterNumber}</p>
      </div>
      <h1 className="mt-2 font-mono text-2xl sm:text-3xl">{chapterTitle}</h1>

      {/* progress: one square per scene */}
      <ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Scenes">
        {Array.from({ length: steps }, (_, i) => {
          const key = `${chapterKey}:${i < scenes.length ? scenes[i].id : "quiz"}`;
          const label = i < scenes.length ? scenes[i].title : "Check yourself";
          return (
            <li key={key}>
              <button
                onClick={() => setIndex(i)}
                aria-label={`Scene ${i + 1}: ${label}`}
                aria-current={i === index ? "step" : undefined}
                title={label}
                className={`grid h-7 w-7 place-items-center border font-mono text-[11px] ${
                  i === index ? "border-white bg-white text-black" : seen.includes(key) ? "border-white/60 text-white" : "border-line text-dim hover:border-white"
                }`}
              >
                {i < scenes.length ? i + 1 : "?"}
              </button>
            </li>
          );
        })}
      </ol>

      <article className="panel mt-4 flex flex-col">
        <header className="border-b border-line p-4">
          <p className="label">{scene ? scene.section : "Check yourself"} · {index + 1} of {steps}</p>
          <h2 className="mt-1 text-xl sm:text-2xl">{scene ? scene.title : "One question before you move on"}</h2>
        </header>

        {scene ? <scene.Visual key={id} /> : <QuizCard key={id} quiz={quiz} />}

        {scene && (
          <div className="grid gap-4 border-t border-line p-4 md:grid-cols-[3fr_2fr]">
            <p className="text-white/85">{scene.text}</p>
            <div className="border-l-2 border-white pl-3">
              <p className="label">Try it</p>
              <p className="mt-1 text-white/85">{scene.tryIt}</p>
            </div>
          </div>
        )}
      </article>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>◂ Back</button>
        {index < steps - 1 ? (
          <button className="btn btn-solid" onClick={() => setIndex((i) => i + 1)}>Next ▸</button>
        ) : next !== null ? (
          <Link className="btn btn-solid" href={`/books/${bookId}/${next}`}>Next chapter ▸</Link>
        ) : (
          <Link className="btn btn-solid" href="/books">All chapters</Link>
        )}
        {scene?.lab && <button className="btn ml-auto" onClick={openInLab}>Open in Lab ▸</button>}
        <span className="label hidden sm:inline">← → keys also work</span>
      </div>
    </div>
  );
}

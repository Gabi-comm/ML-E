"use client";

import { useState } from "react";
import { LESSONS } from "@/lib/lessons";
import Studio from "./Studio";

const FREE = "free";
const CHOICE = "mle:lab-choice";

/** Which lesson to open: free coding when a Books scene sent code over, else the last one used. */
function initialChoice(): string {
  try {
    if (sessionStorage.getItem("mle:lab-code")) return FREE;
    const saved = localStorage.getItem(CHOICE);
    if (saved === FREE || LESSONS.some((l) => l.id === saved)) return saved!;
  } catch {}
  return LESSONS[0].id;
}

export default function Lab() {
  const [choice, setChoice] = useState(initialChoice);
  const lesson = LESSONS.find((l) => l.id === choice);

  const pick = (next: string) => {
    setChoice(next);
    try {
      localStorage.setItem(CHOICE, next);
    } catch {}
  };

  const picker = (
    <label className="ml-1 flex items-center gap-2">
      <span className="label hidden sm:inline">Lesson</span>
      <select
        className="max-w-[16rem] border border-line bg-black px-2 py-[6px] font-mono text-xs text-white"
        value={choice} onChange={(e) => pick(e.target.value)}
      >
        {LESSONS.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        <option value={FREE}>Free coding (examples)</option>
      </select>
    </label>
  );

  const file = lesson ? `lab/lessons/${lesson.id}.py` : "lab/main.py";
  // Each lesson keeps its own file; remounting the studio loads it fresh.
  return <Studio key={file} file={file} lesson={lesson} toolbar={picker} />;
}

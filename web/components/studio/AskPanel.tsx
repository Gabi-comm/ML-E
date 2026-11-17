"use client";

import { useEffect, useRef, useState } from "react";
import { GLOSSARY, searchGlossary, type Entry } from "@/lib/glossary";
import { aiStatus, askTutor } from "@/lib/tutor";
import Rich from "./Rich";

type Turn = { id: number; q: string; entries: Entry[]; seen?: string; answer?: string; error?: string; waiting: boolean };

const STARTERS = ["What does ReLU mean?", "What does .Dense() do?", "What is an epoch?", "Why split into train and test?"];

function EntryCard({ entry }: { entry: Entry }) {
  return (
    <div className="border border-line p-2.5">
      <p className="font-mono text-sm text-white">{entry.term}</p>
      <Rich text={entry.text} className="mt-1 text-white/80" />
      {entry.example && <pre className="mt-2 overflow-x-auto border border-line bg-black p-2 font-mono text-xs text-white/85">{entry.example}</pre>}
    </div>
  );
}

/**
 * Questions about the Lab. Built-in explanations answer instantly; when the engine has
 * Anthropic credentials, Claude answers too, with the code and current step as context.
 */
export default function AskPanel({
  seed, code, context, error, onClose,
}: {
  seed: { text: string; n: number } | null;
  code: string;
  context: string;
  error: string;
  onClose: () => void;
}) {
  const [ai, setAi] = useState<"pro" | "api" | false | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const nextId = useRef(0);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const asked = useRef(0);

  useEffect(() => {
    let alive = true;
    aiStatus().then((ok) => alive && setAi(ok));
    return () => {
      alive = false;
    };
  }, []);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const id = ++nextId.current;
    // a question about an error is matched against the error itself, so built-in help works offline too
    const aboutError = error !== "" && /error|fail|stopped|crash|wrong/i.test(q);
    const seen = aboutError ? error.split("\n")[0] : undefined;
    const entries = searchGlossary(seen ? `${q} ${seen}` : q);
    const useAi = ai === "pro" || ai === "api";
    setTurns((all) => [...all, { id, q, entries, seen, waiting: useAi }]);
    setDraft("");
    if (!useAi) return;
    const history = turns.filter((t) => t.answer).map((t) => ({ q: t.q, a: t.answer! }));
    askTutor({ question: q, code, context, error, history })
      .then((answer) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, answer, waiting: false } : t))))
      .catch((e: Error) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, error: e.message, waiting: false } : t))));
  };

  // a question sent from the editor or the task card
  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });
  useEffect(() => {
    if (!seed || seed.n === asked.current || ai === null) return;
    asked.current = seed.n;
    askRef.current(seed.text);
  }, [seed, ai]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  return (
    <aside className="fixed bottom-0 right-0 top-12 z-40 flex lg:absolute lg:top-0 lg:z-20 w-full max-w-md flex-col border-l border-white bg-black" aria-label="Ask a question">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="font-mono text-sm uppercase tracking-wider">Ask ML-E</span>
        <button className="label hover:text-white" onClick={onClose} aria-label="Close questions">Close ✕</button>
      </div>

      <div ref={log} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3 text-sm">
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-white/80">
              Ask about anything in the Lab: a word, a function, an error. You can also select code in the editor, right-click it and choose <span className="font-mono">Ask ML-E about this</span> (or press Ctrl+I).
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STARTERS.map((s) => <button key={s} className="btn btn-quiet normal-case tracking-normal" onClick={() => ask(s)}>{s}</button>)}
            </div>
            <p className="label pt-2">Or browse</p>
            <div className="flex flex-wrap gap-1">
              {GLOSSARY.map((e) => (
                <button key={e.term} className="border border-line px-1.5 py-0.5 font-mono text-[11px] text-dim hover:border-white hover:text-white" onClick={() => ask(`What is ${e.term}?`)}>
                  {e.term}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id} className="space-y-2">
            <p className="ml-6 border border-line bg-panel p-2 text-white">{t.q}</p>
            {t.seen && (
              <div>
                <p className="label">Your last error</p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap border border-neg p-2 font-mono text-xs text-neg">{t.seen}</pre>
              </div>
            )}
            {t.entries.length > 0 && (
              <div className="space-y-2">
                <p className="label">Built-in explanation{t.entries.length > 1 ? "s" : ""}</p>
                {t.entries.map((e) => <EntryCard key={e.term} entry={e} />)}
              </div>
            )}
            {t.waiting && <p className="flex items-center gap-2 text-dim"><span className="px blink" aria-hidden /> Claude is thinking…</p>}
            {t.answer && (
              <div className="space-y-1">
                <p className="label">Claude</p>
                <Rich text={t.answer} className="text-white/90" />
              </div>
            )}
            {t.error && <p className="text-neg">{t.error}</p>}
            {ai === false && (
              <p className="text-dim">
                {t.entries.length ? "" : "There is no built-in explanation for that yet. "}
                AI answers are off. To use your Claude plan, open a terminal, run <span className="font-mono">claude</span> and sign in with your Claude account, then close and reopen this panel.
              </p>
            )}
          </div>
        ))}
      </div>

      <form className="border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
        <label className="label" htmlFor="ask-input">Your question</label>
        <textarea
          id="ask-input" ref={input} rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(draft); } }}
          placeholder="e.g. what does .fit() do?"
          className="mt-1 w-full resize-none border border-line bg-black px-2 py-1.5 text-sm text-white placeholder:text-faint"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="label">{ai === null ? "" : ai === "pro" ? "Built-in + Claude (your plan)" : ai ? "Built-in + Claude (API key)" : "Built-in answers only"}</span>
          <button type="submit" className="btn btn-solid" disabled={!draft.trim()}>Ask ▸</button>
        </div>
      </form>
    </aside>
  );
}

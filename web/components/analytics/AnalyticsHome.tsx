"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { analyseProject, analyseUpload, listAnalytics, percent, short, type ReportSummary, type Source } from "@/lib/analytics";

const field = "border border-line bg-black px-3 py-2 font-mono text-sm text-white placeholder:text-faint";

function FilePick({ id, label, accept, file, onPick, multiple }: {
  id: string; label: string; accept: string; file: string | null; onPick: (files: File[]) => void; multiple?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <input id={id} type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(e) => onPick([...(e.target.files ?? [])])} />
        <label htmlFor={id} className="btn">Choose file{multiple ? "s" : ""}</label>
        <span className={`font-mono text-sm ${file ? "text-white" : "text-faint"}`}>{file ?? "nothing chosen"}</span>
      </div>
    </div>
  );
}

export default function AnalyticsHome() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const [pick, setPick] = useState("");            // "<project id>/<model file>"
  const [split, setSplit] = useState<"held-out" | "all">("held-out");

  const [name, setName] = useState("");
  const [model, setModel] = useState<File | null>(null);
  const [helpers, setHelpers] = useState<File[]>([]);
  const [data, setData] = useState<File | null>(null);
  const [target, setTarget] = useState("");
  const started = useRef(0);

  useEffect(() => {
    let alive = true;
    listAnalytics()
      .then((result) => {
        if (!alive) return;
        setReports(result.reports);
        setSources(result.projects);
        const first = result.projects[0];
        if (first) setPick(`${first.id}/${first.models[0]}`);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const run = async (what: string, job: () => Promise<{ id: string }>) => {
    if (busy) return;
    started.current = Date.now();
    setSeconds(0);
    setBusy(what);
    setError(null);
    try {
      const report = await job();
      router.push(`/analytics/${report.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const csvData = data?.name.toLowerCase().endsWith(".csv") ?? false;
  const uploadReady = model !== null && data !== null && (!csvData || target.trim() !== "");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
      <p className="label">05 · How good is the model, really?</p>
      <h1 className="mt-2 font-mono text-4xl">Analytics</h1>
      <p className="mt-3 max-w-2xl text-white/75">
        Run a trained model on data it has to answer for, then see where it is right, where it is wrong, and what is inside it.
      </p>

      {busy && (
        <p className="panel mt-6 flex items-center gap-3 p-4" role="status">
          <span className="px blink" aria-hidden />
          <span>Testing {busy}… {seconds}s. Loading the model takes a few seconds before the first answer.</span>
        </p>
      )}
      {error && <p className="mt-6 border border-neg p-4 text-neg" role="alert">{error}</p>}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-mono text-lg">Test a model from a project</h2>
          {sources.length === 0 ? (
            <p className="mt-2 text-white/75">
              No project has a trained model yet. <Link href="/projects" className="underline">Train one in Projects</Link>, then come back.
            </p>
          ) : (
            <>
              <label className="mt-4 flex flex-col gap-1">
                <span className="label">Model</span>
                <select value={pick} onChange={(e) => setPick(e.target.value)} className={field}>
                  {sources.flatMap((s) => s.models.map((m) => <option key={`${s.id}/${m}`} value={`${s.id}/${m}`}>{s.name} · {m}</option>))}
                </select>
              </label>
              <fieldset className="mt-4 flex flex-col gap-2">
                <legend className="label">Test it on</legend>
                {([["held-out", "The 20% held back", "The same rows the starter code keeps away from training. The honest score."],
                   ["all", "All the data", "Includes rows the model trained on, so the score flatters it."]] as const).map(([value, title, text]) => (
                  <label key={value} className={`mt-2 flex cursor-pointer flex-col border p-3 ${split === value ? "border-white" : "border-line hover:border-faint"}`}>
                    <span className="flex items-center gap-2 font-mono text-sm">
                      <input type="radio" name="split" checked={split === value} onChange={() => setSplit(value)} className="accent-white" />
                      {title}
                    </span>
                    <span className="mt-1 text-sm text-dim">{text}</span>
                  </label>
                ))}
              </fieldset>
              <button
                className="btn btn-solid mt-5" disabled={!pick || busy !== null}
                onClick={() => run(pick.split("/")[1], () => analyseProject(pick.split("/")[0], pick.split("/")[1], split))}
              >
                Run the test ▸
              </button>
            </>
          )}
        </section>

        <form
          className="panel flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (model && data && uploadReady) run(model.name, () => analyseUpload({ name, model, helpers, data, target }));
          }}
        >
          <h2 className="font-mono text-lg">Upload a model</h2>
          <FilePick id="up-model" label="Model (.keras or .joblib)" accept=".keras,.joblib" file={model?.name ?? null} onPick={(f) => setModel(f[0] ?? null)} />
          <FilePick
            id="up-helpers" label="Files saved with it, if any (preprocess.joblib, classes.txt)" accept=".joblib,.txt" multiple
            file={helpers.length ? helpers.map((h) => h.name).join(", ") : null} onPick={setHelpers}
          />
          <FilePick id="up-data" label="Test data (.csv, or .zip with one folder of images per class)" accept=".csv,.zip" file={data?.name ?? null} onPick={(f) => setData(f[0] ?? null)} />
          {csvData && (
            <label className="flex flex-col gap-1">
              <span className="label">Column the model predicts</span>
              <input type="text" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. price" className={field} />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="label">Name for this report (optional)</span>
            <input type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Forest v2" className={field} />
          </label>
          <p className="text-sm text-dim">
            A .joblib file can run code when it is opened. Only upload models you made or trust. Files stay on this PC.
          </p>
          <button type="submit" className="btn btn-solid self-start" disabled={!uploadReady || busy !== null}>Run the test ▸</button>
        </form>
      </div>

      <h2 className="mt-10 font-mono text-lg">Reports</h2>
      {reports === null && !error && <p className="mt-3 text-dim">Loading…</p>}
      {reports?.length === 0 && <p className="mt-3 text-dim">No reports yet. Run a test above.</p>}
      {reports && reports.length > 0 && (
        <ul className="mt-3 border-t border-line">
          {reports.map((r) => (
            <li key={r.id} className="border-b border-line">
              <Link href={`/analytics/${r.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-3 px-1 py-3 hover:bg-white hover:text-black">
                <span>
                  <span className="block">{r.name}</span>
                  <span className="label group-hover:text-black/60">
                    {r.task} · {r.tested.toLocaleString()} {r.kind === "images" ? "images" : "rows"} · {new Date(r.created * 1000).toLocaleString()}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-lg tabular-nums">{r.task === "classification" ? percent(r.headline.value) : short(r.headline.value)}</span>
                  <span className="label group-hover:text-black/60">{r.headline.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Studio from "@/components/studio/Studio";
import { exportUrl, getProject, imageUrl, makeStarter, notebookUrl, uploadData, type Column, type Project, type Summary } from "@/lib/projects";

type Tab = "data" | "train" | "export";
const IMAGE_FILE = /\.(png|jpe?g|bmp|gif|webp)$/i;

function Spark({ column }: { column: Column }) {
  if (column.type === "number" && column.hist?.length) {
    const top = Math.max(...column.hist, 1);
    return (
      <span className="flex h-6 items-end gap-px" title={`${column.min} to ${column.max}`}>
        {column.hist.map((count, i) => <span key={i} className="w-1.5 bg-white" style={{ height: `${Math.max(4, (count / top) * 100)}%` }} />)}
      </span>
    );
  }
  return (
    <span className="block max-w-[16rem] truncate font-mono text-[11px] text-dim">
      {(column.top ?? []).slice(0, 3).map(([value, count]) => `${value} (${count})`).join(" · ")}
    </span>
  );
}

function CsvExplore({ summary }: { summary: Summary }) {
  return (
    <>
      <p className="label mt-6">{summary.file} · {summary.rows?.toLocaleString()} rows · {summary.columns?.length} columns</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left">
              {["Column", "Kind", "Missing", "Different values", "Shape of the data"].map((h) => <th key={h} className="label border-b border-line py-2 pr-4 font-normal">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {summary.columns?.map((column) => (
              <tr key={column.name} className="border-b border-line">
                <td className="py-2 pr-4 font-mono">{column.name}</td>
                <td className="py-2 pr-4 text-dim">{column.type}</td>
                <td className={`py-2 pr-4 font-mono tabular-nums ${column.missing ? "text-neg" : "text-dim"}`}>{column.missing}</td>
                <td className="py-2 pr-4 font-mono tabular-nums text-dim">{column.unique}</td>
                <td className="py-2 pr-4"><Spark column={column} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="label mt-6">First rows</p>
      <div className="mt-2 overflow-x-auto">
        <table className="border-collapse font-mono text-xs">
          <thead>
            <tr>{summary.columns?.map((c) => <th key={c.name} className="border border-line px-2 py-1 text-left font-normal text-dim">{c.name}</th>)}</tr>
          </thead>
          <tbody>
            {summary.head?.map((row, i) => (
              <tr key={i}>{row.map((value, j) => <td key={j} className={`border border-line px-2 py-1 ${value === null ? "text-neg" : ""}`}>{value ?? "missing"}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ImageExplore({ id, summary }: { id: string; summary: Summary }) {
  const top = Math.max(...(summary.classes ?? []).map((c) => c.count), 1);
  const sizes = summary.sizes ?? [];
  const sameSize = sizes.every((s) => s[0] === sizes[0]?.[0] && s[1] === sizes[0]?.[1]);
  return (
    <>
      <p className="label mt-6">
        {summary.total?.toLocaleString()} images · {summary.classes?.length} classes
        {sizes.length > 0 && ` · ${sameSize ? `all sampled images are ${sizes[0][0]}×${sizes[0][1]}` : "mixed sizes (they are resized for training)"}`}
      </p>
      <ul className="mt-3 flex flex-col gap-4">
        {summary.classes?.map((cls) => (
          <li key={cls.name}>
            <div className="flex items-center gap-3">
              <span className="w-32 truncate font-mono text-sm">{cls.name}</span>
              <span className="h-3 flex-1"><span className="block h-full bg-white" style={{ width: `${(cls.count / top) * 100}%` }} /></span>
              <span className="w-14 text-right font-mono text-xs tabular-nums text-dim">{cls.count}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {cls.samples.map((path) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={path} src={imageUrl(id, path)} alt={`Sample from class ${cls.name}`} className="h-16 w-16 border border-line object-cover" loading="lazy" />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Workspace({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState<Tab>("data");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [template, setTemplate] = useState<"network" | "forest">("network");
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    getProject(id)
      .then(({ project: p, summary: s }) => {
        setProject(p);
        setSummary(s);
        setTarget((current) => current || p.target || s.suggested_target || "");
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = async (picked: File[]) => {
    if (!project || picked.length === 0) return;
    setError(null);
    try {
      const zip = picked.length === 1 && picked[0].name.toLowerCase().endsWith(".zip");
      const files = project.kind === "images" && !zip ? picked.filter((f) => IMAGE_FILE.test(f.name)) : picked;
      if (files.length === 0) throw new Error("No image files found in that folder.");
      const groups = project.kind === "images" && !zip ? Array.from({ length: Math.ceil(files.length / 150) }, (_, i) => files.slice(i * 150, (i + 1) * 150)) : [files];
      let saved = 0, skipped = 0;
      for (const [i, group] of groups.entries()) {
        setProgress(groups.length > 1 ? `Uploading… ${Math.round((i / groups.length) * 100)}%` : "Uploading…");
        const result = await uploadData(id, group);
        saved += result.saved;
        skipped += result.skipped;
        setProject(result.project);
        setSummary(result.summary);
        if (result.summary.suggested_target) setTarget(result.summary.suggested_target);
      }
      setProgress(skipped ? `Saved ${saved}. Skipped ${skipped} that were not inside a class folder.` : null);
    } catch (e) {
      setProgress(null);
      setError((e as Error).message);
    }
    if (fileInput.current) fileInput.current.value = "";
    if (folderInput.current) folderInput.current.value = "";
  };

  const generate = async () => {
    if (!project) return;
    if (project.has_code && !window.confirm("This replaces the code currently in this project with a fresh starter. Continue?")) return;
    setError(null);
    try {
      const result = await makeStarter(id, project.kind === "csv" ? target : null, template);
      setProject(result.project);
      setTab("train");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error && !project) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
        <Link href="/projects" className="label hover:text-white">◂ Projects</Link>
        <p className="mt-6 text-neg" role="alert">{error}</p>
      </div>
    );
  }
  if (!project || !summary) return <p className="label p-8">Loading project…</p>;

  const tabs: [Tab, string][] = [["data", "1 · Data"], ["train", "2 · Build and train"], ["export", "3 · Export"]];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2">
        <Link href="/projects" className="label hover:text-white">◂ Projects</Link>
        <h1 className="font-mono text-lg">{project.name}</h1>
        <span className="label">{project.kind === "csv" ? "CSV project" : "Image project"}</span>
        <div className="ml-auto flex" role="tablist">
          {tabs.map(([key, label]) => (
            <button
              key={key} role="tab" aria-selected={tab === key} onClick={() => { setTab(key); if (key === "export") refresh(); }}
              className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest ${tab === key ? "bg-white text-black" : "text-dim hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "data" && (
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8">
          <div className="panel p-5">
            <h2 className="font-mono text-lg">{summary.ready ? "Replace or add data" : "Add your data"}</h2>
            <p className="mt-1 text-white/75">
              {project.kind === "csv"
                ? "Choose one .csv file. The first row should hold the column names."
                : "Choose a folder (or a .zip of it) that contains one sub-folder per class, for example cats/ and dogs/."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                ref={fileInput} type="file" className="sr-only" id="pick-file"
                accept={project.kind === "csv" ? ".csv,text/csv" : ".zip,application/zip"}
                onChange={(e) => upload([...(e.target.files ?? [])])}
              />
              <label htmlFor="pick-file" className="btn btn-solid">{project.kind === "csv" ? "Choose CSV file" : "Choose .zip file"}</label>
              {project.kind === "images" && (
                <>
                  <input
                    ref={folderInput} type="file" className="sr-only" id="pick-folder" multiple
                    {...({ webkitdirectory: "" } as Record<string, string>)}
                    onChange={(e) => upload([...(e.target.files ?? [])])}
                  />
                  <label htmlFor="pick-folder" className="btn">Choose a folder</label>
                </>
              )}
            </div>
            {progress && <p className="mt-3 text-white/80" role="status">{progress}</p>}
            {error && <p className="mt-3 text-neg" role="alert">{error}</p>}
            <p className="mt-3 text-sm text-dim">Files are copied into this project&apos;s folder on your PC. Nothing is sent anywhere else.</p>
          </div>

          {summary.ready && (
            <>
              {project.kind === "csv" ? <CsvExplore summary={summary} /> : <ImageExplore id={id} summary={summary} />}
              <div className="panel mt-8 flex flex-wrap items-end gap-4 p-5">
                {project.kind === "csv" && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="label">Column to predict</span>
                      <select value={target} onChange={(e) => setTarget(e.target.value)} className="border border-line bg-black px-3 py-2 font-mono text-sm text-white">
                        {summary.columns?.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="label">Start with</span>
                      <select value={template} onChange={(e) => setTemplate(e.target.value as "network" | "forest")} className="border border-line bg-black px-3 py-2 font-mono text-sm text-white">
                        <option value="network">Neural network (shown in 3D)</option>
                        <option value="forest">Random forest (often best for tables)</option>
                      </select>
                    </label>
                  </>
                )}
                <button className="btn btn-solid" onClick={generate}>{project.has_code ? "Regenerate training code ▸" : "Generate training code ▸"}</button>
                {project.has_code && <button className="btn" onClick={() => setTab("train")}>Keep my code and continue ▸</button>}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "train" &&
        (project.has_code ? (
          <>
            <p className="border-b border-line px-4 py-1.5 text-sm text-dim">
              Runs on this PC&apos;s processor: the installed PyTorch has no GPU support yet. For a GPU, use Export to train on Kaggle.
            </p>
            <Studio file={`projects/${id}/main.py`} cwd={`projects/${id}`} heightClass="lg:h-[calc(100dvh-8.5rem)]" />
          </>
        ) : (
          <div className="mx-auto max-w-xl px-4 py-12 text-center">
            <p className="text-lg text-white/85">There is no training code in this project yet.</p>
            <button className="btn btn-solid mt-4" onClick={() => setTab("data")}>Go to Data to generate it</button>
          </div>
        ))}

      {tab === "export" && (
        <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-6 sm:px-8 md:grid-cols-2">
          <div className="panel p-5">
            <h2 className="font-mono text-lg">Take the project with you</h2>
            <p className="mt-1 text-white/75">One zip with your code, your data, the project settings and any trained models.</p>
            <a className="btn btn-solid mt-4 inline-block" href={exportUrl(id)} download>Download project .zip</a>
            <p className="label mt-5">Trained models in this project</p>
            {project.models.length ? (
              <ul className="mt-1 font-mono text-sm">{project.models.map((m) => <li key={m}>models/{m}</li>)}</ul>
            ) : (
              <p className="mt-1 text-sm text-dim">None yet. Run the training code first.</p>
            )}
          </div>
          <div className="panel p-5">
            <h2 className="font-mono text-lg">Train on Kaggle&apos;s GPU</h2>
            <p className="mt-1 text-white/75">Download a notebook that runs this project&apos;s code on Kaggle.</p>
            {project.has_code ? (
              <a className="btn btn-solid mt-4 inline-block" href={notebookUrl(id)} download>Download Kaggle notebook</a>
            ) : (
              <p className="mt-4 text-sm text-neg">Generate the training code first.</p>
            )}
            <ol className="mt-5 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-white/80">
              <li>On Kaggle, create a new dataset and upload the <span className="font-mono">data</span> folder from the project zip.</li>
              <li>Create a notebook and choose File → Import Notebook to load the downloaded file.</li>
              <li>Use Add Input to attach your dataset, and pick a GPU under Settings → Accelerator.</li>
              <li>Run All. The trained model appears under Output.</li>
            </ol>
            <p className="mt-4 text-sm text-dim">Sending the job to Kaggle directly from ML-E is not built yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}

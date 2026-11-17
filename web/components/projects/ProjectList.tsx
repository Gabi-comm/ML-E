"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createProject, listProjects, type Project } from "@/lib/projects";

export default function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Project["kind"]>("csv");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    listProjects()
      .then((list) => alive && setProjects(list))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const project = await createProject(name, kind);
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const option = (value: Project["kind"], title: string, text: string) => (
    <label className={`flex cursor-pointer flex-col gap-1 border p-4 ${kind === value ? "border-white bg-white text-black" : "border-line hover:border-white"}`}>
      <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
      <span className="font-mono text-sm uppercase tracking-wider">{title}</span>
      <span className={`text-sm ${kind === value ? "text-black/70" : "text-dim"}`}>{text}</span>
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
      <p className="label">04 · Your own data, your own model</p>
      <h1 className="mt-2 font-mono text-4xl">Projects</h1>

      <form onSubmit={create} className="panel mt-8 p-5">
        <h2 className="font-mono text-lg">Start a new project</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {option("csv", "CSV file", "A table of rows and columns. Predict one column from the others.")}
          {option("images", "Image dataset", "Folders of pictures, one folder per class. Teach a model to tell them apart.")}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
            <span className="label">Project name</span>
            <input
              type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. House prices"
              className="border border-line bg-black px-3 py-2 text-white placeholder:text-faint"
            />
          </label>
          <button type="submit" className="btn btn-solid" disabled={!name.trim() || busy}>{busy ? "Creating…" : "Create project ▸"}</button>
        </div>
        {error && <p className="mt-3 text-neg" role="alert">{error}</p>}
      </form>

      <h2 className="mt-10 font-mono text-lg">Your projects</h2>
      {projects === null && !error && <p className="mt-3 text-dim">Loading…</p>}
      {projects?.length === 0 && <p className="mt-3 text-dim">No projects yet. Create one above.</p>}
      {projects && projects.length > 0 && (
        <ul className="mt-3 border-t border-line">
          {projects.map((p) => (
            <li key={p.id} className="border-b border-line">
              <Link href={`/projects/${p.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-3 px-1 py-3 hover:bg-white hover:text-black">
                <span>
                  <span className="block">{p.name}</span>
                  <span className="label group-hover:text-black/60">
                    {p.kind === "csv" ? "CSV" : "Images"} · {p.models.length ? "model trained" : p.has_code ? "code ready" : "needs data"}
                  </span>
                </span>
                <span className="label text-pos group-hover:text-black">Open ▸</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

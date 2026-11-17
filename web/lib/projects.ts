import { ENGINE_HTTP } from "./engine";

export type Project = {
  id: string;
  name: string;
  kind: "csv" | "images";
  created: number;
  target: string | null;
  data_file: string | null;
  has_code: boolean;
  models: string[];
};

export type Column = {
  name: string;
  type: "number" | "category" | "text";
  missing: number;
  unique: number;
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  hist?: number[];
  top?: [string, number][];
};

export type Summary = {
  ready: boolean;
  // csv
  file?: string;
  rows?: number;
  columns?: Column[];
  head?: (string | null)[][];
  suggested_target?: string | null;
  // images
  classes?: { name: string; count: number; samples: string[] }[];
  total?: number;
  sizes?: [number, number][];
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ENGINE_HTTP}${path}`, init);
  } catch {
    throw new Error("The Python engine is not running. Start it with: pnpm engine");
  }
  if (!response.ok) {
    const detail = await response.json().then((body) => body.detail).catch(() => null);
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status})`);
  }
  return response.json();
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const listProjects = () => call<{ projects: Project[] }>("/api/projects").then((r) => r.projects);
export const createProject = (name: string, kind: Project["kind"]) => call<Project>("/api/projects", json({ name, kind }));
export const getProject = (id: string) => call<{ project: Project; summary: Summary }>(`/api/projects/${id}`);
export const makeStarter = (id: string, target: string | null, template: "network" | "forest") =>
  call<{ code: string; project: Project }>(`/api/projects/${id}/starter`, json({ target, template }));

/** Upload a CSV, a zip of class folders, or image files picked from a folder. */
export function uploadData(id: string, picked: File[]) {
  const form = new FormData();
  for (const file of picked) {
    form.append("uploads", file, file.name);
    form.append("paths", (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
  }
  return call<{ saved: number; skipped: number; project: Project; summary: Summary }>(`/api/projects/${id}/upload`, { method: "POST", body: form });
}

export const imageUrl = (id: string, path: string) => `${ENGINE_HTTP}/api/projects/${id}/image?path=${encodeURIComponent(path)}`;
export const exportUrl = (id: string) => `${ENGINE_HTTP}/api/projects/${id}/export`;
export const notebookUrl = (id: string) => `${ENGINE_HTTP}/api/projects/${id}/notebook`;

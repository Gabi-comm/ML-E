import { ENGINE_HTTP, type Layer } from "./engine";

export type Hist = { counts: number[]; min: number | null; max: number | null };
export type ModelLayer = Layer & { weights?: Hist & { mean: number | null; std: number | null; near_zero: number | null } };

export type ModelInfo = {
  framework: "keras" | "scikit-learn";
  type: string;
  // keras
  params?: number;
  layers?: ModelLayer[];
  weights?: Record<string, number[][]>;
  // scikit-learn
  facts?: [string, string][];
  importances?: { label: string; items: [string, number][] };
};

export type Curve = { name: string; auc: number; ap: number; share: number; roc: [number[], number[]]; pr: [number[], number[]] };

export type Wrong = {
  actual: string; predicted: string; confidence: number; actual_chance: number;
  where: string; thumb?: string | null; row?: [string, string][];
};

export type Classification = {
  accuracy: number; macro_f1: number; baseline: number; classes: string[]; matrix: number[][];
  per_class: { name: string; precision: number; recall: number; f1: number; support: number }[];
  curves: Curve[]; sure: { from: number; to: number; right: number; wrong: number }[];
  wrong: Wrong[]; wrong_total: number;
};

export type Regression = {
  mae: number; rmse: number; r2: number | null; baseline_mae: number; mean_actual: number; bias: number;
  points: [number, number][]; errors: Hist;
  worst: { where: string; actual: number; predicted: number; error: number; row: [string, string][] }[];
};

export type Report = {
  id: string; name: string; created: number; kind: "csv" | "images"; task: "classification" | "regression";
  tested: number; available: number; split: "held-out" | "all"; target: string | null; model_file: string;
  note: string | null; seconds: number; model: ModelInfo;
  source: { project?: string; project_name?: string; upload?: boolean; data_file?: string };
  classification?: Classification; regression?: Regression;
};

export type ReportSummary = {
  id: string; name: string; created: number; task: Report["task"]; kind: Report["kind"]; tested: number;
  headline: { label: string; value: number };
};

export type Source = { id: string; name: string; kind: "csv" | "images"; models: string[] };

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

export const listAnalytics = () => call<{ reports: ReportSummary[]; projects: Source[] }>("/api/analytics");
export const getReport = (id: string) => call<Report>(`/api/analytics/${id}`);
export const deleteReport = (id: string) => call<{ ok: boolean }>(`/api/analytics/${id}`, { method: "DELETE" });

export const analyseProject = (project: string, model: string, split: "held-out" | "all") =>
  call<Report>("/api/analytics/project", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project, model, split }),
  });

export function analyseUpload(input: { name: string; model: File; helpers: File[]; data: File; target: string }) {
  const form = new FormData();
  form.append("name", input.name);
  form.append("target", input.target);
  form.append("model", input.model, input.model.name);
  form.append("data", input.data, input.data.name);
  for (const helper of input.helpers) form.append("helpers", helper, helper.name);
  return call<Report>("/api/analytics/upload", { method: "POST", body: form });
}

export const percent = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? "n/a" : `${(value * 100).toFixed(digits)}%`;

/** A number short enough to read at a glance. */
export const short = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "n/a";
  const size = Math.abs(value);
  if (size >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (size >= 10) return value.toFixed(1);
  if (size >= 0.01 || size === 0) return value.toFixed(2);
  return value.toExponential(1);
};

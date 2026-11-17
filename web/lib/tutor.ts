import { ENGINE_HTTP } from "./engine";

export type CheckResult = { ok: boolean; message: string; error?: boolean };
export type AskTurn = { q: string; a: string };

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ENGINE_HTTP}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("The Python engine is not running. Start it with: pnpm engine");
  }
  if (!response.ok) {
    const detail = await response.json().then((b) => b.detail).catch(() => null);
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status})`);
  }
  return response.json();
}

/** Run a lesson step's check next to the variables the code just made. */
export const checkStep = (check: string, code: string) => post<CheckResult>("/api/check", { check, code });

export async function aiStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${ENGINE_HTTP}/api/ask`);
    return response.ok && (await response.json()).ai === true;
  } catch {
    return false;
  }
}

export const askTutor = (input: { question: string; code: string; context: string; error: string; history: AskTurn[] }) =>
  post<{ answer: string }>("/api/ask", input).then((r) => r.answer);

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const ENGINE_HTTP = "http://127.0.0.1:8000";
const ENGINE_WS = "ws://127.0.0.1:8000/ws/kernel";

export type Layer = {
  type: string;
  units: number | null;
  activation: string | null;
  name?: string;
  params?: number;
  line?: number;
  shape?: number[] | null;
};

export type LayerWeights = { layer: number; w: number[][] };

export type MleEvent =
  | { kind: "model"; layers: Layer[] }
  | { kind: "train_begin"; epochs: number; weights: LayerWeights[] }
  | { kind: "batch"; step: number; loss: number }
  | { kind: "epoch"; epoch: number; epochs: number; step: number; logs: Record<string, number>; weights: LayerWeights[] }
  | { kind: "metrics"; step: number; values: Record<string, number> }
  | { kind: "train_end" };

export type EngineMessage =
  | { type: "status"; state: "starting" | "idle" | "busy" | "dead" }
  | { type: "stream"; name: "stdout" | "stderr"; text: string }
  | { type: "error"; ename: string; evalue: string; traceback: string[] }
  | { type: "image"; png: string }
  | { type: "html"; html: string }
  | { type: "mle"; event: MleEvent }
  | { type: "done" };

export type EngineState = "offline" | "starting" | "idle" | "busy" | "dead";

export type ParseResult = { ok: boolean; error?: string; line?: number | null; layers: Layer[] };

export async function parseCode(code: string, signal?: AbortSignal): Promise<ParseResult> {
  const response = await fetch(`${ENGINE_HTTP}/api/parse`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
    signal,
  });
  if (!response.ok) throw new Error(`parse failed: ${response.status}`);
  return response.json();
}

export async function loadFile(path: string): Promise<string | null> {
  try {
    const response = await fetch(`${ENGINE_HTTP}/api/files/content?path=${encodeURIComponent(path)}`);
    if (!response.ok) return null;
    return (await response.json()).content as string;
  } catch {
    return null;
  }
}

export async function saveFile(path: string, content: string): Promise<boolean> {
  try {
    const response = await fetch(`${ENGINE_HTTP}/api/files/content`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Live connection to the Python engine. Reconnects on its own while the page is open. */
export function useEngine(onMessage: (message: EngineMessage) => void) {
  const [state, setState] = useState<EngineState>("offline");
  const socket = useRef<WebSocket | null>(null);
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(ENGINE_WS);
      socket.current = ws;
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as EngineMessage;
        if (message.type === "status") setState(message.state);
        handler.current(message);
      };
      ws.onclose = () => {
        if (socket.current === ws) socket.current = null;
        setState("offline");
        retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, []);

  const send = useCallback((payload: object) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify(payload));
    return true;
  }, []);

  return {
    state,
    run: useCallback((code: string) => send({ type: "execute", code }), [send]),
    interrupt: useCallback(() => send({ type: "interrupt" }), [send]),
    restart: useCallback(() => send({ type: "restart" }), [send]),
  };
}

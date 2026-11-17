"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadFile,
  parseCode,
  saveFile,
  useEngine,
  type EngineMessage,
  type EngineState,
  type Layer,
} from "@/lib/engine";
import { EXAMPLES } from "@/lib/examples";
import LossChart, { type Series } from "./LossChart";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <p className="label p-3">Loading editor…</p>,
});
const Network3D = dynamic(() => import("./Network3D"), { ssr: false });

const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
const MAX_CONSOLE = 60_000;

type Output = { id: number; kind: "image"; png: string } | { id: number; kind: "html"; html: string };

const STATUS: Record<EngineState, string> = {
  offline: "Engine offline",
  starting: "Engine warming up",
  idle: "Ready",
  busy: "Running",
  dead: "Engine stopped",
};

function push(series: Series, name: string, x: number, y: number): Series {
  return { ...series, [name]: [...(series[name] ?? []), [x, y]] };
}

/**
 * The split-screen workbench: code on the left, live visualisation on the right.
 * `cwd` is the workspace folder the code runs in; `heightClass` sets its height on wide screens.
 */
export default function Studio({
  file, cwd = "", heightClass = "lg:h-[calc(100dvh-3rem)]",
}: { file: string; cwd?: string; heightClass?: string }) {
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [parsed, setParsed] = useState<Layer[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [live, setLive] = useState<Layer[] | null>(null);
  const [weights, setWeights] = useState<Record<number, number[][]>>({});
  const [series, setSeries] = useState<Series>({});
  const [text, setText] = useState("");
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [tab, setTab] = useState<"chart" | "output">("chart");
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [cursorLine, setCursorLine] = useState<number | null>(null);
  const outputId = useRef(0);
  const consoleRef = useRef<HTMLPreElement>(null);

  const append = useCallback((chunk: string) => {
    setText((previous) => (previous + chunk.replace(ANSI, "")).slice(-MAX_CONSOLE));
  }, []);

  const onMessage = useCallback(
    (message: EngineMessage) => {
      switch (message.type) {
        case "stream":
          append(message.text);
          break;
        case "error":
          append(`\n${message.traceback.length ? message.traceback.join("\n") : `${message.ename}: ${message.evalue}`}\n`);
          break;
        case "image":
          setOutputs((o) => [...o, { id: ++outputId.current, kind: "image", png: message.png }]);
          setTab("output");
          break;
        case "html":
          setOutputs((o) => [...o, { id: ++outputId.current, kind: "html", html: message.html }]);
          setTab("output");
          break;
        case "done":
          setTraining(false);
          break;
        case "mle": {
          const event = message.event;
          const mapWeights = (list: { layer: number; w: number[][] }[]) =>
            setWeights(Object.fromEntries(list.map((item) => [item.layer, item.w])));
          if (event.kind === "model") setLive(event.layers);
          else if (event.kind === "train_begin") {
            setTraining(true);
            setTab("chart");
            setProgress(`epoch 0 / ${event.epochs}`);
            mapWeights(event.weights);
          } else if (event.kind === "batch") setSeries((s) => push(s, "loss (batch)", event.step, event.loss));
          else if (event.kind === "epoch") {
            setProgress(`epoch ${event.epoch} / ${event.epochs}`);
            mapWeights(event.weights);
            setSeries((s) => Object.entries(event.logs).reduce((acc, [k, v]) => push(acc, k, event.step, v), s));
          } else if (event.kind === "metrics") {
            setTraining(true);
            setTab("chart");
            setSeries((s) => Object.entries(event.values).reduce((acc, [k, v]) => push(acc, k, event.step, v), s));
          } else if (event.kind === "train_end") setTraining(false);
          break;
        }
      }
    },
    [append],
  );

  const engine = useEngine(onMessage);
  const online = engine.state !== "offline";

  // code sent over from a Books scene wins; otherwise open the saved file
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    let handoff: string | null = null;
    try {
      handoff = sessionStorage.getItem("mle:lab-code");
      sessionStorage.removeItem("mle:lab-code");
    } catch {}
    if (handoff) {
      loaded.current = true;
      setCode(handoff);
      return;
    }
    if (!online) return;
    loaded.current = true;
    loadFile(file).then((saved) => {
      if (saved !== null && saved.trim() !== "") setCode(saved);
    });
  }, [online, file]);

  // re-read the model from the code shortly after each edit
  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      parseCode(code, controller.signal)
        .then((result) => {
          if (result.ok) {
            setParsed(result.layers);
            setParseError(null);
          } else {
            // keep the last good model on screen while the code is half-typed
            setParseError(`line ${result.line ?? "?"}: ${result.error}`);
          }
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [code, online]);

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  const edit = (next: string) => {
    setCode(next);
    setLive(null);
    setWeights({});
  };

  const run = useCallback(() => {
    if (engine.state !== "idle") return;
    setText("");
    setOutputs([]);
    setSeries({});
    setWeights({});
    setLive(null);
    setProgress(null);
    void saveFile(file, code);
    engine.run(code, cwd);
  }, [engine, code, file, cwd]);

  const layers = live ?? parsed;
  const lossSeries = Object.fromEntries(Object.entries(series).filter(([k]) => k.includes("loss")));
  const otherSeries = Object.fromEntries(Object.entries(series).filter(([k]) => !k.includes("loss")));
  const hasChart = Object.keys(series).length > 0;
  const totalParams = layers.reduce((sum, l) => sum + (l.params ?? 0), 0);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${heightClass}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-black px-3 py-2">
        <button className="btn btn-solid" onClick={run} disabled={engine.state !== "idle"} title="Ctrl+Enter">
          ▶ Run
        </button>
        <button className="btn" onClick={engine.interrupt} disabled={engine.state !== "busy"}>
          ■ Stop
        </button>
        <button className="btn btn-quiet" onClick={engine.restart} disabled={!online || engine.state === "starting"}>
          Restart
        </button>
        <label className="ml-1 flex items-center gap-2">
          <span className="label hidden sm:inline">Example</span>
          <select
            className="border border-line bg-black px-2 py-[6px] font-mono text-xs text-white"
            value=""
            onChange={(event) => {
              const example = EXAMPLES.find((x) => x.id === event.target.value);
              if (example) edit(example.code);
            }}
          >
            <option value="" disabled>
              Load…
            </option>
            {EXAMPLES.map((example) => (
              <option key={example.id} value={example.id}>
                {example.name}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto flex items-center gap-2 font-mono text-xs uppercase tracking-wider" role="status">
          <span
            className={`px ${engine.state === "busy" || engine.state === "starting" ? "blink" : ""}`}
            style={{ background: engine.state === "idle" || engine.state === "busy" ? "#7cffb2" : engine.state === "starting" ? "#ffd166" : "#ff5c7a" }}
            aria-hidden
          />
          {STATUS[engine.state]}
          {progress && engine.state === "busy" ? ` · ${progress}` : ""}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        {/* left: IDE */}
        <section className="flex min-h-0 flex-col border-line lg:border-r" aria-label="Code">
          <div className="flex items-center justify-between border-b border-line px-3 py-1">
            <span className="label">{file}</span>
            {parseError && <span className="truncate pl-3 font-mono text-[11px] text-neg">{parseError}</span>}
          </div>
          <div className="h-[50vh] min-h-0 lg:h-auto lg:flex-1">
            <CodeEditor value={code} onChange={edit} onCursorLine={setCursorLine} onRun={run} />
          </div>
          <div className="flex h-44 shrink-0 flex-col border-t border-line">
            <span className="label px-3 pt-2">Console</span>
            <pre ref={consoleRef} className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-3 pb-2 font-mono text-xs leading-relaxed text-white/85">
              {text || <span className="text-faint">Output from print() and errors appear here.</span>}
            </pre>
          </div>
        </section>

        {/* right: live visualisation */}
        <section className="flex min-h-0 flex-col border-t border-line lg:border-t-0" aria-label="Visualisation">
          <div className="flex items-center justify-between border-b border-line px-3 py-1">
            <span className="label">
              Network · {live ? "from the running model" : "read from your code"}
            </span>
            <span className="label">
              {layers.length} layers{totalParams > 0 ? ` · ${totalParams.toLocaleString()} params` : ""}
            </span>
          </div>
          <div className="relative h-[50vh] min-h-0 lg:h-auto lg:flex-1">
            {layers.length > 0 && (
              <Network3D layers={layers} weights={weights} activeLine={live ? null : cursorLine} training={training} />
            )}
            {layers.length === 0 && online && (
              <p className="absolute inset-0 grid place-items-center px-6 text-center text-dim">
                No model in this code yet. Write a layer such as layers.Dense(8) and it appears here.
              </p>
            )}
            {!online && (
              <div className="absolute inset-0 grid place-items-center bg-black/80 p-6">
                <div className="panel max-w-md p-5">
                  <p className="label text-neg">Engine offline</p>
                  <p className="mt-2 text-white/85">
                    The Python engine is not running, so code cannot run or be visualised. Start it from the project
                    folder:
                  </p>
                  <pre className="mt-3 border border-line bg-black p-3 font-mono text-sm">pnpm engine</pre>
                  <p className="mt-3 text-sm text-dim">This page reconnects by itself.</p>
                </div>
              </div>
            )}
            {layers.length > 0 && (
              <p className="label pointer-events-none absolute bottom-2 left-3">Drag to rotate · scroll to zoom</p>
            )}
          </div>

          <div className="flex h-56 shrink-0 flex-col border-t border-line">
            <div className="flex border-b border-line" role="tablist">
              {(["chart", "output"] as const).map((name) => (
                <button
                  key={name}
                  role="tab"
                  aria-selected={tab === name}
                  onClick={() => setTab(name)}
                  className={`px-3 py-1 font-mono text-[11px] uppercase tracking-widest ${
                    tab === name ? "bg-white text-black" : "text-dim hover:text-white"
                  }`}
                >
                  {name === "chart" ? "Training" : `Output${outputs.length ? ` (${outputs.length})` : ""}`}
                </button>
              ))}
            </div>
            {tab === "chart" ? (
              hasChart ? (
                <div className="flex min-h-0 flex-1">
                  <LossChart title="Loss" series={lossSeries} />
                  {Object.keys(otherSeries).length > 0 && <LossChart title="Metrics" series={otherSeries} />}
                </div>
              ) : (
                <p className="grid flex-1 place-items-center px-6 text-center text-sm text-dim">
                  Run code that trains a model to watch its loss here. Keras fit() is tracked automatically.
                </p>
              )
            ) : outputs.length > 0 ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
                {outputs.map((output) =>
                  output.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={output.id} src={`data:image/png;base64,${output.png}`} alt="Plot produced by your code" className="max-w-full" />
                  ) : (
                    <div key={output.id} className="mle-html overflow-auto" dangerouslySetInnerHTML={{ __html: output.html }} />
                  ),
                )}
              </div>
            ) : (
              <p className="grid flex-1 place-items-center px-6 text-center text-sm text-dim">
                Plots and tables made by your code appear here.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

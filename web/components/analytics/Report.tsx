"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DIM, POS, Readout, line, plot, square, useCanvas } from "@/components/scenes/ui";
import {
  deleteReport, getReport, listAnalytics, percent, short,
  type Classification, type Hist, type ModelInfo, type Regression, type Report as ReportData, type ReportSummary,
} from "@/lib/analytics";

const Network3D = dynamic(() => import("@/components/studio/Network3D"), { ssr: false });

type Tab = "results" | "mistakes" | "model" | "compare";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="panel p-5">
      <h2 className="font-mono text-lg">{title}</h2>
      {hint && <p className="mt-1 max-w-3xl text-sm text-white/70">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bar({ value, tone = "white" }: { value: number; tone?: "white" | "pos" | "neg" }) {
  const color = tone === "pos" ? "bg-pos" : tone === "neg" ? "bg-neg" : "bg-white";
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-24 border border-line"><span className={`block h-full ${color}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></span>
      <span className="w-12 font-mono text-xs tabular-nums">{percent(value, 0)}</span>
    </span>
  );
}

function Bars({ hist, center }: { hist: Hist; center?: boolean }) {
  const top = Math.max(...hist.counts, 1);
  const middle = (hist.counts.length - 1) / 2;
  return (
    <div>
      <div className="flex h-28 items-end gap-px">
        {hist.counts.map((count, i) => (
          <span
            key={i} title={`${count}`}
            className={`flex-1 ${center && i === middle ? "bg-pos" : "bg-white"}`}
            style={{ height: count ? `${Math.max(2, (count / top) * 100)}%` : "0" }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-dim">
        <span>{short(hist.min)}</span>
        {center && <span>0</span>}
        <span>{short(hist.max)}</span>
      </div>
    </div>
  );
}

// -- classification -----------------------------------------------------------
function Matrix({ result }: { result: Classification }) {
  const { classes, matrix } = result;
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse font-mono text-xs">
        <thead>
          <tr>
            <th className="p-1 text-left font-normal text-dim">actual ↓ · model said →</th>
            {classes.map((name) => <th key={name} className="max-w-20 truncate p-1 font-normal text-dim" title={name}>{name}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => {
            const total = row.reduce((a, b) => a + b, 0) || 1;
            return (
              <tr key={classes[i]}>
                <th className="max-w-32 truncate p-1 text-left font-normal" title={classes[i]}>{classes[i]}</th>
                {row.map((count, j) => {
                  const side = Math.round(Math.sqrt(count / total) * 34);
                  return (
                    <td key={j} className="border border-line p-0" title={`${count} of ${total} ${classes[i]} were called ${classes[j]}`}>
                      <span className="relative flex h-12 w-12 items-center justify-center">
                        <span className={i === j ? "bg-pos" : "bg-neg"} style={{ width: side, height: side, opacity: count ? 1 : 0 }} />
                        <span className={`absolute inset-0 flex items-center justify-center tabular-nums ${count === 0 ? "text-faint" : side > 16 ? "font-semibold text-black" : "text-white"}`}>{count}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CurveChart({ xs, ys, kind, share }: { xs: number[]; ys: number[]; kind: "roc" | "pr"; share: number }) {
  const ref = useCanvas((ctx, w, h) => {
    const p = plot(ctx, w, h, [0, 1], [0, 1], kind === "roc" ? { x: "false alarms", y: "found" } : { x: "recall", y: "precision" });
    // the dashed line is what random guessing would score
    if (kind === "roc") line(ctx, p, 1, -1, 0, DIM, [4, 4]);
    else line(ctx, p, 0, 1, -share, DIM, [4, 4]);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    xs.forEach((x, i) => (i === 0 ? ctx.moveTo(p.px(x), p.py(ys[i])) : ctx.lineTo(p.px(x), p.py(ys[i]))));
    ctx.stroke();
    if (xs.length <= 40) xs.forEach((x, i) => square(ctx, p.px(x), p.py(ys[i]), 4, "#fff"));
  }, [xs, ys, kind, share]);
  return <canvas ref={ref} className="h-64 w-full" role="img" aria-label={kind === "roc" ? "ROC curve" : "Precision-recall curve"} />;
}

function ClassificationResults({ result, tested }: { result: Classification; tested: number }) {
  const [chosen, setChosen] = useState(result.curves[0]?.name ?? "");
  const curve = result.curves.find((c) => c.name === chosen) ?? result.curves[0];
  const top = Math.max(...result.sure.map((b) => b.right + b.wrong), 1);
  const lift = result.accuracy - result.baseline;
  return (
    <>
      <div className="panel flex flex-wrap gap-x-10 gap-y-4 p-5">
        <Readout label="Accuracy" value={percent(result.accuracy)} tone={lift > 0.02 ? "pos" : "neg"} />
        <Readout label="Always guessing the biggest class" value={percent(result.baseline)} />
        <Readout label="Macro F1" value={percent(result.macro_f1)} />
        <Readout label="Wrong answers" value={`${result.wrong_total.toLocaleString()} of ${tested.toLocaleString()}`} />
        <p className="basis-full text-sm text-white/70">
          {lift > 0.02
            ? `The model beats blind guessing by ${(lift * 100).toFixed(1)} points. Macro F1 treats every class as equally important, so it drops when a small class is handled badly.`
            : "The model is no better than always answering with the most common class. Accuracy alone would hide that."}
        </p>
      </div>

      <Section title="Confusion matrix" hint="Each row is what the examples really were; each column is what the model said. Green squares on the diagonal are correct. Red squares show which classes get mixed up. Square size is the share of that row.">
        <Matrix result={result} />
      </Section>

      <Section title="Class by class" hint="Precision: when the model says this class, how often it is right. Recall: of the real examples of this class, how many it found. F1 combines the two.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left">{["Class", "Precision", "Recall", "F1", "Examples"].map((h) => <th key={h} className="label border-b border-line py-2 pr-4 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>
              {result.per_class.map((c) => (
                <tr key={c.name} className="border-b border-line">
                  <td className="py-2 pr-4 font-mono">{c.name}</td>
                  <td className="py-2 pr-4"><Bar value={c.precision} /></td>
                  <td className="py-2 pr-4"><Bar value={c.recall} /></td>
                  <td className="py-2 pr-4"><Bar value={c.f1} tone={c.f1 < 0.5 ? "neg" : "white"} /></td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-dim">{c.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {curve && (
        <Section title="Trade-off curves" hint="The model gives each example a score. Moving the cut-off trades missed cases against false alarms. A curve hugging the top is good; the dashed line is random guessing.">
          <label className="flex max-w-xs flex-col gap-1">
            <span className="label">Class</span>
            <select value={curve.name} onChange={(e) => setChosen(e.target.value)} className="border border-line bg-black px-3 py-2 font-mono text-sm text-white">
              {result.curves.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <Readout label="ROC · area under the curve" value={curve.auc.toFixed(3)} />
              <CurveChart xs={curve.roc[0]} ys={curve.roc[1]} kind="roc" share={curve.share} />
            </div>
            <div>
              <Readout label="Precision-recall · average precision" value={curve.ap.toFixed(3)} />
              <CurveChart xs={curve.pr[0]} ys={curve.pr[1]} kind="pr" share={curve.share} />
            </div>
          </div>
        </Section>
      )}

      <Section title="When it is sure, is it right?" hint="Answers grouped by how confident the model was. A well-behaved model is mostly wrong on the left (unsure) and almost never wrong on the right (sure). Red on the far right means confident mistakes.">
        <div className="flex h-36 items-end gap-1">
          {result.sure.map((b) => (
            <span key={b.from} className="flex h-full flex-1 flex-col justify-end" title={`${percent(b.from, 0)} to ${percent(b.to, 0)} sure: ${b.right} right, ${b.wrong} wrong`}>
              <span className="bg-neg" style={{ height: `${(b.wrong / top) * 100}%` }} />
              <span className="bg-pos" style={{ height: `${(b.right / top) * 100}%` }} />
            </span>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[11px] text-dim"><span>0% sure</span><span>50%</span><span>100% sure</span></div>
        <p className="mt-2 flex gap-4 font-mono text-[11px] uppercase tracking-wider text-dim">
          <span><span className="mr-1 inline-block h-2 w-2 bg-pos" />right</span>
          <span><span className="mr-1 inline-block h-2 w-2 bg-neg" />wrong</span>
        </p>
      </Section>
    </>
  );
}

function Row({ row }: { row: [string, string][] }) {
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
      {row.map(([key, value]) => (
        <div key={key} className="contents"><dt className="text-dim">{key}</dt><dd className="truncate">{value}</dd></div>
      ))}
    </dl>
  );
}

function ClassificationMistakes({ result }: { result: Classification }) {
  if (result.wrong.length === 0) return <p className="panel p-5 text-pos">No mistakes on this test data.</p>;
  return (
    <Section
      title="The mistakes it was most sure about"
      hint={`${result.wrong.length} of ${result.wrong_total.toLocaleString()} wrong answers, most confident first. These are the best place to look: either the model learned something false, or the label in the data is wrong.`}
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.wrong.map((w, i) => (
          <li key={i} className="border border-line p-3">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {w.thumb && <img src={w.thumb} alt={`Test image that is really ${w.actual}`} className="h-20 w-20 shrink-0 border border-line object-cover" />}
              <div className="min-w-0 text-sm">
                <p>Said <span className="font-mono text-neg">{w.predicted}</span> · {percent(w.confidence, 0)} sure</p>
                <p>Really <span className="font-mono text-pos">{w.actual}</span> · gave it {percent(w.actual_chance, 0)}</p>
                <p className="label mt-1 truncate" title={w.where}>{w.where}</p>
              </div>
            </div>
            {w.row && <Row row={w.row} />}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// -- regression ---------------------------------------------------------------
function Scatter({ points }: { points: [number, number][] }) {
  const ref = useCanvas((ctx, w, h) => {
    const all = points.flat();
    let lo = Math.min(...all), hi = Math.max(...all);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.04;
    const range: [number, number] = [Number((lo - pad).toPrecision(3)), Number((hi + pad).toPrecision(3))];
    const p = plot(ctx, w, h, range, range, { x: "actual", y: "predicted" });
    line(ctx, p, 1, -1, 0, POS, [4, 4]);
    ctx.globalAlpha = points.length > 200 ? 0.6 : 0.9;
    for (const [actual, predicted] of points) square(ctx, p.px(actual), p.py(predicted), 4, "#fff");
    ctx.globalAlpha = 1;
  }, [points]);
  return <canvas ref={ref} className="h-80 w-full" role="img" aria-label="Predicted against actual values" />;
}

function RegressionResults({ result }: { result: Regression }) {
  const better = result.mae < result.baseline_mae;
  return (
    <>
      <div className="panel flex flex-wrap gap-x-10 gap-y-4 p-5">
        <Readout label="Average error (MAE)" value={short(result.mae)} tone={better ? "pos" : "neg"} />
        <Readout label="Always guessing the middle value" value={short(result.baseline_mae)} />
        <Readout label="RMSE" value={short(result.rmse)} />
        <Readout label="R²" value={result.r2 === null ? "n/a" : result.r2.toFixed(3)} />
        <Readout label="Leans" value={`${result.bias > 0 ? "+" : ""}${short(result.bias)}`} />
        <p className="basis-full text-sm text-white/70">
          On average the prediction is off by {short(result.mae)}, on values that average {short(result.mean_actual)}.
          {better ? " That beats always answering with the middle value." : " That is no better than always answering with the middle value."}
          {" "}RMSE is larger than MAE when a few predictions are far off. R² is the share of the variation the model explains; 1 is perfect.
        </p>
      </div>
      <Section title="Predicted against actual" hint="Each square is one test row. Perfect predictions sit on the dashed line. Squares above it were predicted too high, below it too low.">
        <Scatter points={result.points} />
      </Section>
      <Section title="How far off, and in which direction" hint="Prediction minus the real value for every test row. A good model has a tall narrow pile centred on zero. A pile shifted to one side means it leans high or low.">
        <Bars hist={result.errors} center />
      </Section>
    </>
  );
}

function RegressionMistakes({ result }: { result: Regression }) {
  return (
    <Section title="The rows it got most wrong" hint="Largest errors first. Look for what these rows share: an unusual value, a rare category, or a mistake in the data.">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.worst.map((w, i) => (
          <li key={i} className="border border-line p-3 text-sm">
            <p>Predicted <span className="font-mono">{short(w.predicted)}</span> · really <span className="font-mono">{short(w.actual)}</span></p>
            <p className={w.error > 0 ? "text-neg" : "text-pos"}>{w.error > 0 ? "Too high" : "Too low"} by <span className="font-mono">{short(Math.abs(w.error))}</span></p>
            <p className="label mt-1">{w.where}</p>
            <Row row={w.row} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

// -- the model itself ---------------------------------------------------------
function Spark({ hist }: { hist: Hist }) {
  const top = Math.max(...hist.counts, 1);
  return (
    <span className="flex h-7 w-28 items-end gap-px" title={`${short(hist.min)} to ${short(hist.max)}`}>
      {hist.counts.map((count, i) => <span key={i} className="flex-1 bg-white" style={{ height: `${Math.max(3, (count / top) * 100)}%` }} />)}
    </span>
  );
}

function ModelView({ model }: { model: ModelInfo }) {
  const weights = useMemo(
    () => Object.fromEntries(Object.entries(model.weights ?? {}).map(([key, value]) => [Number(key), value])) as Record<number, number[][]>,
    [model.weights],
  );
  if (model.framework === "keras" && model.layers) {
    const most = Math.max(...model.layers.map((l) => l.params ?? 0), 1);
    return (
      <>
        <Section title={`${model.type} · ${(model.params ?? 0).toLocaleString()} parameters`} hint="Drag to rotate. Green lines are positive weights, red are negative, brighter means stronger. Large layers show 16 of their nodes.">
          <div className="h-[26rem] border border-line"><Network3D layers={model.layers} weights={weights} activeLine={null} training={false} /></div>
        </Section>
        <Section title="Layer by layer" hint="Where the parameters are, and how each layer's weights are spread. Healthy weights form a hill around zero. A single spike at zero means a layer that learned nothing.">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">{["Layer", "Output shape", "Parameters", "", "Weights", "Spread"].map((h, i) => <th key={i} className="label border-b border-line py-2 pr-4 font-normal">{h}</th>)}</tr>
              </thead>
              <tbody>
                {model.layers.map((layer, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-2 pr-4 font-mono">{layer.type}{layer.activation ? <span className="text-dim"> · {layer.activation}</span> : null}</td>
                    <td className="py-2 pr-4 font-mono text-dim">{layer.shape?.length ? layer.shape.join("×") : "—"}</td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums">{(layer.params ?? 0).toLocaleString()}</td>
                    <td className="py-2 pr-4"><span className="block h-2.5 w-24"><span className="block h-full bg-white" style={{ width: `${((layer.params ?? 0) / most) * 100}%` }} /></span></td>
                    <td className="py-2 pr-4">{layer.weights?.counts.length ? <Spark hist={layer.weights} /> : <span className="text-faint">none</span>}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-dim">{layer.weights ? `±${short(layer.weights.std)}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </>
    );
  }
  const items = model.importances?.items ?? [];
  const top = Math.max(...items.map(([, value]) => value), 1e-12);
  return (
    <>
      <Section title={model.type} hint="This is a scikit-learn model, so there are no layers to draw. These are the facts that describe it.">
        <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          {(model.facts ?? []).map(([key, value]) => (
            <div key={key} className="contents"><dt className="text-dim">{key}</dt><dd className="font-mono">{value}</dd></div>
          ))}
        </dl>
      </Section>
      {items.length > 0 && (
        <Section title={model.importances!.label} hint="Longer bars are inputs the model leaned on more. An input you expected to matter but that sits near zero is worth a second look.">
          <ul className="flex flex-col gap-1.5">
            {items.map(([name, value]) => (
              <li key={name} className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-3">
                <span className="truncate font-mono text-sm" title={name}>{name}</span>
                <span className="h-3"><span className="block h-full bg-white" style={{ width: `${(value / top) * 100}%` }} /></span>
                <span className="text-right font-mono text-xs tabular-nums text-dim">{short(value)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

// -- compare ------------------------------------------------------------------
function metrics(report: ReportData): [string, number | null, "high" | "low"][] {
  if (report.classification) {
    const c = report.classification;
    return [["Accuracy", c.accuracy, "high"], ["Macro F1", c.macro_f1, "high"], ...c.per_class.map((p): [string, number, "high"] => [`F1 · ${p.name}`, p.f1, "high"])];
  }
  const r = report.regression!;
  return [["Average error (MAE)", r.mae, "low"], ["RMSE", r.rmse, "low"], ["R²", r.r2, "high"]];
}

function Compare({ report }: { report: ReportData }) {
  const [others, setOthers] = useState<ReportSummary[] | null>(null);
  const [otherId, setOtherId] = useState("");
  const [other, setOther] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAnalytics()
      .then((result) => alive && setOthers(result.reports.filter((r) => r.id !== report.id && r.task === report.task)))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [report.id, report.task]);

  useEffect(() => {
    if (!otherId) return;
    let alive = true;
    getReport(otherId).then((r) => alive && setOther(r)).catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [otherId]);

  if (error) return <p className="panel p-5 text-neg" role="alert">{error}</p>;
  if (others === null) return <p className="label p-5">Loading…</p>;
  if (others.length === 0) {
    return <p className="panel p-5 text-white/75">There is no other {report.task} report to compare with yet. Test a second model from the <Link href="/analytics" className="underline">Analytics page</Link>.</p>;
  }
  const shown = other && other.id === otherId ? other : null;
  const mine = metrics(report);
  const theirs = new Map(shown ? metrics(shown).map(([name, value]) => [name, value]) : []);
  const format = (value: number | null | undefined) => (report.task === "classification" ? percent(value) : short(value));
  return (
    <Section title="Side by side" hint="The better number in each row is green. The comparison is only fair when both models were tested on the same data.">
      <label className="flex max-w-md flex-col gap-1">
        <span className="label">Compare with</span>
        <select value={otherId} onChange={(e) => setOtherId(e.target.value)} className="border border-line bg-black px-3 py-2 font-mono text-sm text-white">
          <option value="">Choose a report…</option>
          {others.map((r) => <option key={r.id} value={r.id}>{r.name} · {new Date(r.created * 1000).toLocaleString()}</option>)}
        </select>
      </label>
      {shown && (
        <>
          {(shown.tested !== report.tested || shown.split !== report.split) && (
            <p className="mt-4 text-sm text-neg">These two were tested on different data ({report.tested.toLocaleString()} against {shown.tested.toLocaleString()} examples), so treat the differences with care.</p>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="label border-b border-line py-2 pr-4 font-normal">Measure</th>
                  <th className="label border-b border-line py-2 pr-4 font-normal">{report.name}</th>
                  <th className="label border-b border-line py-2 pr-4 font-normal">{shown.name}</th>
                </tr>
              </thead>
              <tbody>
                {mine.map(([name, value, good]) => {
                  const rival = theirs.get(name);
                  const known = typeof value === "number" && typeof rival === "number" && value !== rival;
                  const win = known && (good === "high" ? value > rival : value < rival);
                  return (
                    <tr key={name} className="border-b border-line">
                      <td className="py-2 pr-4">{name}</td>
                      <td className={`py-2 pr-4 font-mono tabular-nums ${known && win ? "text-pos" : ""}`}>{format(value)}</td>
                      <td className={`py-2 pr-4 font-mono tabular-nums ${known && !win ? "text-pos" : ""}`}>{rival === undefined ? "—" : format(rival)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}

// -- page ---------------------------------------------------------------------
export default function Report({ id }: { id: string }) {
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("results");

  useEffect(() => {
    let alive = true;
    getReport(id).then((r) => alive && setReport(r)).catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
        <Link href="/analytics" className="label hover:text-white">◂ Analytics</Link>
        <p className="mt-6 text-neg" role="alert">{error}</p>
      </div>
    );
  }
  if (!report) return <p className="label p-8">Loading report…</p>;

  const remove = async () => {
    if (!window.confirm("Delete this report? Files uploaded for it are removed too. Project files are not touched.")) return;
    try {
      await deleteReport(id);
      router.push("/analytics");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const unit = report.kind === "images" ? "images" : "rows";
  const tabs: [Tab, string][] = [["results", "Results"], ["mistakes", "Mistakes"], ["model", "The model"], ["compare", "Compare"]];
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2">
        <Link href="/analytics" className="label hover:text-white">◂ Analytics</Link>
        <h1 className="font-mono text-lg">{report.name}</h1>
        <span className="label">{report.task}</span>
        <div className="ml-auto flex" role="tablist">
          {tabs.map(([key, label]) => (
            <button
              key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest ${tab === key ? "bg-white text-black" : "text-dim hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-8">
        <p className="text-sm text-white/75">
          Tested on {report.tested.toLocaleString()} of {report.available.toLocaleString()} {unit}
          {report.split === "held-out"
            ? ": the 20% the starter code holds back from training. If you changed how the code splits the data, some of these may have been seen in training."
            : report.source.upload ? `, everything in ${report.source.data_file}.` : ", all of the project's data. That includes examples the model trained on, so the scores flatter it."}
          {report.kind === "images" && " Pixels were scaled the way ML-E's starter code does it."}
          {report.note ? ` ${report.note}` : ""}
        </p>

        {tab === "results" && (report.classification
          ? <ClassificationResults result={report.classification} tested={report.tested} />
          : <RegressionResults result={report.regression!} />)}
        {tab === "mistakes" && (report.classification
          ? <ClassificationMistakes result={report.classification} />
          : <RegressionMistakes result={report.regression!} />)}
        {tab === "model" && <ModelView model={report.model} />}
        {tab === "compare" && <Compare report={report} />}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="label">
            {report.model_file} · {new Date(report.created * 1000).toLocaleString()} · took {report.seconds}s
            {report.source.project && <> · <Link href={`/projects/${report.source.project}`} className="underline hover:text-white">open project</Link></>}
          </span>
          <button className="btn btn-quiet" onClick={remove}>Delete report</button>
        </div>
      </div>
    </div>
  );
}

"""Run a trained model on test data and write a report. Runs as its own process:

    python -m mle_server.evaluate <job.json>

Opening .joblib files can execute code, so this never runs inside the server itself.
"""
from __future__ import annotations

import base64
import io
import json
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np

IMAGE_TYPES = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp")
MAX_IMAGES = 5000
MAX_NODES = 16


class EvalError(Exception):
    """A problem the user can fix; its message is shown as-is."""


def _num(value: Any, digits: int = 4) -> float | None:
    value = float(value)
    return round(value, digits) if np.isfinite(value) else None


def _thin(*arrays: np.ndarray, keep: int = 80) -> list[list[float]]:
    """Keep at most `keep` evenly spaced points of a curve."""
    n = len(arrays[0])
    index = np.unique(np.linspace(0, n - 1, min(n, keep)).round().astype(int))
    return [[round(float(v), 4) for v in a[index]] for a in arrays]


# -- loading -----------------------------------------------------------------
def load_model(job: dict[str, Any]) -> dict[str, Any]:
    path = Path(job["model"])
    found: dict[str, Any] = {"prepare": None, "classes": None, "file": path.name}
    suffix = path.suffix.lower()
    if suffix == ".keras":
        import os

        os.environ.setdefault("KERAS_BACKEND", "torch")
        import keras

        found.update(framework="keras", model=keras.saving.load_model(path))
    elif suffix in (".joblib", ".pkl"):
        import joblib

        loaded = joblib.load(path)
        if isinstance(loaded, dict):
            if "model" not in loaded:
                raise EvalError("this .joblib file holds a dictionary without a 'model' entry, so there is nothing to test")
            found.update(prepare=loaded.get("prepare"), classes=loaded.get("classes"))
            loaded = loaded["model"]
        if not hasattr(loaded, "predict"):
            raise EvalError("the object in this file has no predict() method, so it is not a trained model")
        found.update(framework="sklearn", model=loaded)
    else:
        raise EvalError("only .keras and .joblib models can be opened for now")

    for helper in job.get("helpers") or []:
        helper = Path(helper)
        if helper.suffix.lower() == ".txt":
            found["classes"] = [line for line in helper.read_text(encoding="utf-8").splitlines() if line.strip()]
        elif helper.suffix.lower() in (".joblib", ".pkl"):
            import joblib

            extra = joblib.load(helper)
            if isinstance(extra, dict):
                found["prepare"] = extra.get("prepare", found["prepare"])
                found["classes"] = extra.get("classes", found["classes"])
            elif hasattr(extra, "transform"):
                found["prepare"] = extra
    if found["classes"] is not None:
        found["classes"] = [str(c) for c in found["classes"]]
    return found


# -- describing the model ----------------------------------------------------
def _hist(values: np.ndarray, bins: int = 24) -> dict[str, Any]:
    values = values[np.isfinite(values)]
    if not len(values):
        return {"counts": [], "min": None, "max": None}
    counts, edges = np.histogram(values, bins=bins)
    return {"counts": [int(c) for c in counts], "min": _num(edges[0]), "max": _num(edges[-1])}


def describe_keras(model: Any) -> dict[str, Any]:
    layers: list[dict[str, Any]] = []
    weights: dict[str, Any] = {}
    try:
        dims = [d for d in tuple(model.input_shape)[1:] if isinstance(d, int)]
        layers.append({"name": "input", "type": "Input", "units": int(np.prod(dims)) if dims else None,
                       "activation": None, "params": 0, "shape": dims})
    except Exception:
        pass
    for layer in model.layers:
        if type(layer).__name__ == "InputLayer":
            continue
        try:
            shape = [d for d in tuple(layer.output.shape)[1:] if isinstance(d, int)]
        except Exception:
            shape = []
        activation = getattr(getattr(layer, "activation", None), "__name__", None)
        entry: dict[str, Any] = {
            "name": layer.name, "type": type(layer).__name__, "units": shape[-1] if shape else None,
            "activation": None if activation == "linear" else activation,
            "params": int(layer.count_params()), "shape": shape,
        }
        try:
            arrays = layer.get_weights()
        except Exception:
            arrays = []
        if arrays:
            kernel = np.asarray(arrays[0], dtype="float64")
            entry["weights"] = {**_hist(kernel.ravel()), "mean": _num(kernel.mean()), "std": _num(kernel.std()),
                                "near_zero": _num(np.mean(np.abs(kernel) < 1e-3))}
            if kernel.ndim == 2:
                weights[str(len(layers))] = [[round(float(v), 4) for v in row] for row in kernel[:MAX_NODES, :MAX_NODES]]
        layers.append(entry)
    return {"framework": "keras", "type": type(model).__name__, "params": int(model.count_params()),
            "layers": layers, "weights": weights}


def describe_sklearn(model: Any, prepare: Any) -> dict[str, Any]:
    info: dict[str, Any] = {"framework": "scikit-learn", "type": type(model).__name__, "facts": []}
    final = model.steps[-1][1] if hasattr(model, "steps") else model
    if final is not model:
        info["facts"].append(["Pipeline steps", " → ".join(type(step).__name__ for _, step in model.steps)])
    if hasattr(final, "n_features_in_"):
        info["facts"].append(["Inputs it expects", str(int(final.n_features_in_))])
    trees = getattr(final, "estimators_", None)
    if trees is not None and len(trees) and hasattr(np.ravel(trees)[0], "tree_"):
        flat = list(np.ravel(trees))
        info["facts"].append(["Trees", f"{len(flat):,}"])
        info["facts"].append(["Average depth", f"{np.mean([t.tree_.max_depth for t in flat]):.1f}"])
        info["facts"].append(["Decision points in total", f"{sum(t.tree_.node_count for t in flat):,}"])
    elif hasattr(final, "tree_"):
        info["facts"].append(["Depth", str(int(final.tree_.max_depth))])
        info["facts"].append(["Decision points", f"{int(final.tree_.node_count):,}"])

    names: list[str] | None = None
    for source in (prepare, model[:-1] if hasattr(model, "steps") and len(model.steps) > 1 else None, final):
        try:
            names = [str(n).split("__")[-1] for n in source.get_feature_names_out()]
            break
        except Exception:
            pass
    if names is None and hasattr(final, "feature_names_in_"):
        names = [str(n) for n in final.feature_names_in_]

    scores, label = None, None
    if hasattr(final, "feature_importances_"):
        scores, label = np.asarray(final.feature_importances_, dtype="float64"), "How much the model relied on each input"
    elif hasattr(final, "coef_"):
        coef = np.asarray(final.coef_, dtype="float64")
        scores, label = (np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)), "Size of each input's weight"
    if scores is not None and scores.ndim == 1 and len(scores):
        if names is None or len(names) != len(scores):
            names = [f"input {i}" for i in range(len(scores))]
        order = np.argsort(scores)[::-1][:15]
        info["importances"] = {"label": label, "items": [[names[i], _num(scores[i])] for i in order]}
    return info


# -- data --------------------------------------------------------------------
def _split(n: int, y: np.ndarray | None, how: str, stratify: bool) -> np.ndarray:
    """Row numbers to test on. 'held-out' repeats the 80/20 split ML-E's starter code makes."""
    index = np.arange(n)
    if how != "held-out":
        return index
    if n < 5:
        raise EvalError("there are too few rows to hold some out. Choose 'all the data' instead")
    from sklearn.model_selection import train_test_split

    strat = y if stratify and y is not None and np.bincount(y).min() > 1 else None
    return np.sort(train_test_split(index, test_size=0.2, random_state=42, stratify=strat)[1])


def _row(df: Any, i: int) -> list[list[str]]:
    return [[str(c), "missing" if v is None or v != v else str(v)[:40]] for c, v in list(df.iloc[i].items())[:10]]


def load_csv(job: dict[str, Any], found: dict[str, Any]) -> dict[str, Any]:
    import pandas as pd

    df = pd.read_csv(job["data"], low_memory=False)
    target = job.get("target")
    if not target or target not in df.columns:
        raise EvalError(f"the test data has no column named {target!r}. Its columns are: {', '.join(map(str, df.columns[:30]))}")
    df = df.dropna(subset=[target]).reset_index(drop=True)
    model, classes = found["model"], found["classes"]

    if found["framework"] == "sklearn":
        from sklearn.base import is_classifier

        classify = classes is not None or is_classifier(model)
        if classify and classes is None:
            classes = [str(c) for c in getattr(model, "classes_", sorted(df[target].astype(str).unique()))]
    else:
        outputs = int(model.output_shape[-1])
        classify = classes is not None or outputs > 1 or df[target].nunique() <= 2
        if classify and classes is None:
            classes = sorted(df[target].astype(str).unique())
            if outputs > 1 and len(classes) != outputs:
                raise EvalError(f"the model has {outputs} outputs but the {target!r} column has {len(classes)} different values. "
                                "Add the classes file saved with the model so the answers can be matched up")

    y = None
    if classify:
        lookup = {name: i for i, name in enumerate(classes)}
        labels = df[target].astype(str).str.strip()
        if labels.map(lookup).isna().all():   # e.g. the file says 1.0 where the model learned "1"
            labels = labels.str.replace(r"\.0$", "", regex=True)
        known = labels.map(lookup)
        df = df[known.notna()].reset_index(drop=True)
        if not len(df):
            raise EvalError(f"none of the values in {target!r} match the classes the model knows: {', '.join(classes[:12])}")
        y = known.dropna().to_numpy().astype(int)
    else:
        y = pd.to_numeric(df[target], errors="coerce").to_numpy(dtype="float64")
        if np.isnan(y).all():
            raise EvalError(f"{target!r} holds text, but this model predicts a number")
        keep = ~np.isnan(y)
        df, y = df[keep].reset_index(drop=True), y[keep]

    rows = _split(len(df), y if classify else None, job.get("split", "all"), classify)
    frame = df.drop(columns=[target])
    X: Any = frame.iloc[rows]
    if found["prepare"] is not None:
        try:
            X = np.asarray(found["prepare"].transform(X), dtype="float32")
        except Exception as exc:
            raise EvalError(f"the test data does not have the columns this model was trained on ({exc})")
    elif found["framework"] == "keras":
        X = X.select_dtypes("number").to_numpy(dtype="float32")
        expected = model.input_shape[-1]
        if X.shape[1] != expected:
            raise EvalError(f"the model expects {expected} numbers per row but the test data has {X.shape[1]} number columns. "
                            "Add the preprocess file that was saved with the model")
    return {"kind": "csv", "task": "classification" if classify else "regression", "X": X, "y": y[rows],
            "classes": classes, "rows": rows, "frame": df, "total": len(df)}


def load_images(job: dict[str, Any], found: dict[str, Any]) -> dict[str, Any]:
    from PIL import Image

    if found["framework"] != "keras":
        raise EvalError("image data can only be tested with a .keras model")
    base = Path(job["data"])
    folders = sorted(p.name for p in base.iterdir() if p.is_dir())
    classes = found["classes"] or folders
    paths, labels = [], []
    for index, name in enumerate(classes):
        if (base / name).is_dir():
            for file in sorted(p.name for p in (base / name).iterdir()):   # same order as the starter code
                if file.lower().endswith(IMAGE_TYPES):
                    paths.append(base / name / file)
                    labels.append(index)
    if not paths:
        raise EvalError("no test images found. Each class needs its own folder, named like the classes the model learned: "
                        + ", ".join(classes[:12]))
    y = np.array(labels)
    rows = _split(len(paths), y, job.get("split", "all"), True)
    note = None
    if len(rows) > MAX_IMAGES:
        rows = np.sort(np.random.default_rng(0).choice(rows, MAX_IMAGES, replace=False))
        note = f"Tested on a random {MAX_IMAGES:,} of the images to keep this quick."
    shape = tuple(found["model"].input_shape)
    if len(shape) != 4 or not all(isinstance(d, int) for d in shape[1:]):
        raise EvalError("this model does not take fixed-size images as input")
    height, width, channels = shape[1:]
    rescales = any(type(layer).__name__ == "Rescaling" for layer in found["model"].layers)
    batch = np.empty((len(rows), height, width, channels), dtype="float32")
    for slot, i in enumerate(rows):
        with Image.open(paths[i]) as picture:
            pixels = np.asarray(picture.convert("L" if channels == 1 else "RGB").resize((width, height)), dtype="float32")
        batch[slot] = pixels.reshape(height, width, channels) if rescales else pixels.reshape(height, width, channels) / 255.0
    return {"kind": "images", "task": "classification", "X": batch, "y": y[rows], "classes": classes, "rows": rows,
            "paths": paths, "base": base, "total": len(paths), "note": note}


def _thumb(path: Path) -> str | None:
    from PIL import Image

    try:
        with Image.open(path) as picture:
            picture = picture.convert("RGB")
            picture.thumbnail((112, 112))
            buffer = io.BytesIO()
            picture.save(buffer, "JPEG", quality=80)
        return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    except Exception:
        return None


# -- predicting and scoring --------------------------------------------------
def _probabilities(found: dict[str, Any], X: Any, n_classes: int) -> np.ndarray:
    model = found["model"]
    if found["framework"] == "keras":
        out = np.asarray(model.predict(X, verbose=0), dtype="float64")
        out = out.reshape(len(out), -1)
        if out.shape[1] == 1:
            out = np.hstack([1 - out, out])
        elif out.min() < 0 or abs(out.sum(axis=1).mean() - 1) > 0.01:   # raw scores, not probabilities
            out = np.exp(out - out.max(axis=1, keepdims=True))
            out /= out.sum(axis=1, keepdims=True)
    elif hasattr(model, "predict_proba"):
        out = np.asarray(model.predict_proba(X), dtype="float64")
    else:
        learned = [str(c) for c in getattr(model, "classes_", range(n_classes))]
        picks = [str(p) for p in model.predict(X)]
        out = np.zeros((len(picks), n_classes))
        for i, pick in enumerate(picks):
            out[i, learned.index(pick) if pick in learned else 0] = 1.0
    if out.shape[1] != n_classes:
        raise EvalError(f"the model gives {out.shape[1]} answers per example but there are {n_classes} classes")
    return out


def classification(found: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    from sklearn import metrics

    classes, y = data["classes"], data["y"]
    n = len(classes)
    probs = _probabilities(found, data["X"], n)
    pred = probs.argmax(axis=1)
    precision, recall, f1, support = metrics.precision_recall_fscore_support(y, pred, labels=range(n), zero_division=0)
    per_class = [{"name": classes[i], "precision": _num(precision[i]), "recall": _num(recall[i]), "f1": _num(f1[i]),
                  "support": int(support[i])} for i in range(n)]

    curves = []
    for i in range(n):
        truth = (y == i).astype(int)
        if truth.min() == truth.max():
            continue   # this class is missing from the test data (or is all of it)
        fpr, tpr, _ = metrics.roc_curve(truth, probs[:, i])
        p, r, _ = metrics.precision_recall_curve(truth, probs[:, i])
        roc_x, roc_y = _thin(fpr, tpr)
        pr_x, pr_y = _thin(r[::-1], p[::-1])
        curves.append({"name": classes[i], "auc": _num(metrics.auc(fpr, tpr)), "ap": _num(metrics.average_precision_score(truth, probs[:, i])),
                       "share": _num(truth.mean()), "roc": [roc_x, roc_y], "pr": [pr_x, pr_y]})

    confidence = probs.max(axis=1)
    right = pred == y
    edges = np.linspace(0, 1, 11)
    sure = [{"from": _num(edges[b]), "to": _num(edges[b + 1]),
             "right": int(np.sum(right & (confidence >= edges[b]) & ((confidence < edges[b + 1]) | (b == 9)))),
             "wrong": int(np.sum(~right & (confidence >= edges[b]) & ((confidence < edges[b + 1]) | (b == 9))))} for b in range(10)]

    wrong = []
    for slot in sorted(np.flatnonzero(~right), key=lambda s: -confidence[s])[:12]:
        source = int(data["rows"][slot])
        item: dict[str, Any] = {"actual": classes[y[slot]], "predicted": classes[pred[slot]],
                                "confidence": _num(confidence[slot]), "actual_chance": _num(probs[slot, y[slot]])}
        if data["kind"] == "images":
            item.update(where=data["paths"][source].relative_to(data["base"]).as_posix(), thumb=_thumb(data["paths"][source]))
        else:
            item.update(where=f"row {source + 2}", row=_row(data["frame"], source))
        wrong.append(item)

    return {"accuracy": _num(right.mean()), "macro_f1": _num(f1[support > 0].mean() if (support > 0).any() else 0),
            "baseline": _num(np.bincount(y, minlength=n).max() / len(y)), "classes": classes,
            "matrix": metrics.confusion_matrix(y, pred, labels=range(n)).tolist(), "per_class": per_class,
            "curves": curves, "sure": sure, "wrong": wrong, "wrong_total": int((~right).sum())}


def regression(found: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    from sklearn import metrics

    y = data["y"]
    pred = np.asarray(found["model"].predict(data["X"], verbose=0) if found["framework"] == "keras"
                      else found["model"].predict(data["X"]), dtype="float64").reshape(len(y), -1)[:, 0]
    error = pred - y
    show = np.arange(len(y)) if len(y) <= 600 else np.sort(np.random.default_rng(0).choice(len(y), 600, replace=False))
    counts, edges = np.histogram(error, bins=21, range=(-np.abs(error).max() or -1, np.abs(error).max() or 1))
    worst = [{"where": f"row {int(data['rows'][s]) + 2}", "actual": _num(y[s]), "predicted": _num(pred[s]), "error": _num(error[s]),
              "row": _row(data["frame"], int(data["rows"][s]))} for s in np.argsort(-np.abs(error))[:10]]
    return {"mae": _num(np.abs(error).mean()), "rmse": _num(np.sqrt(np.mean(error ** 2))),
            "r2": _num(metrics.r2_score(y, pred)) if len(y) > 1 else None,
            "baseline_mae": _num(np.abs(y - np.median(y)).mean()), "mean_actual": _num(y.mean()),
            "bias": _num(error.mean()), "points": [[_num(y[s]), _num(pred[s])] for s in show],
            "errors": {"counts": [int(c) for c in counts], "min": _num(edges[0]), "max": _num(edges[-1])}, "worst": worst}


def run(job: dict[str, Any]) -> dict[str, Any]:
    started = time.time()
    found = load_model(job)
    data = load_images(job, found) if job["kind"] == "images" else load_csv(job, found)
    if len(data["y"]) == 0:
        raise EvalError("there is no test data left to run the model on")
    report: dict[str, Any] = {
        "kind": data["kind"], "task": data["task"], "tested": int(len(data["y"])), "available": int(data["total"]),
        "split": job.get("split", "all"), "target": job.get("target"), "model_file": found["file"], "note": data.get("note"),
        "model": describe_keras(found["model"]) if found["framework"] == "keras" else describe_sklearn(found["model"], found["prepare"]),
    }
    report[data["task"]] = (classification if data["task"] == "classification" else regression)(found, data)
    report["seconds"] = round(time.time() - started, 1)
    return report


def main(job_file: str) -> int:
    job = json.loads(Path(job_file).read_text(encoding="utf-8"))
    out = Path(job["out"])
    try:
        result: dict[str, Any] = {"ok": True, "report": run(job)}
    except EvalError as exc:
        result = {"ok": False, "error": str(exc)}
    except Exception as exc:  # anything else: say what kind of failure it was
        result = {"ok": False, "error": f"The model could not be tested: {type(exc).__name__}: {exc}"}
    out.write_text(json.dumps(result), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))

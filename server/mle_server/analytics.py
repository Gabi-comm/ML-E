"""Analytics: test a trained model and keep the report under workspace/analytics/<id>/."""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from typing import Any, BinaryIO

from . import files, projects

MODEL_TYPES = {".keras", ".joblib"}
HELPER_TYPES = {".joblib", ".txt"}
MAX_MODEL_BYTES = 2 * 1024 * 1024 * 1024
MAX_HELPER_BYTES = 200 * 1024 * 1024
TIMEOUT_SECONDS = 15 * 60
SERVER_DIR = Path(__file__).resolve().parents[1]
_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")

AnalyticsError = projects.ProjectError


def root() -> Path:
    path = files.root() / "analytics"
    path.mkdir(parents=True, exist_ok=True)
    return path


def report_dir(rid: str) -> Path:
    if not _ID.match(rid or "") or not (root() / rid / "report.json").is_file():
        raise AnalyticsError("unknown report")
    return root() / rid


def _new_dir(name: str) -> Path:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "report"
    rid, n = f"{base}-{time.strftime('%m%d-%H%M%S')}", 2
    while (root() / rid).exists():
        rid, n = f"{base}-{time.strftime('%m%d-%H%M%S')}-{n}", n + 1
    (root() / rid).mkdir(parents=True)
    return root() / rid


def _headline(report: dict[str, Any]) -> dict[str, Any]:
    if report["task"] == "classification":
        return {"label": "accuracy", "value": report["classification"]["accuracy"]}
    return {"label": "average error", "value": report["regression"]["mae"]}


def _run(folder: Path, name: str, job: dict[str, Any], source: dict[str, Any]) -> dict[str, Any]:
    """Run the evaluator in its own Python process and store what it returns."""
    job["out"] = str(folder / "result.json")
    (folder / "job.json").write_text(json.dumps(job), encoding="utf-8")
    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join(filter(None, [str(SERVER_DIR), env.get("PYTHONPATH")]))
    env["KERAS_BACKEND"] = "torch"
    try:
        done = subprocess.run([sys.executable, "-m", "mle_server.evaluate", str(folder / "job.json")],
                              cwd=str(folder), env=env, capture_output=True, text=True, timeout=TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        shutil.rmtree(folder, ignore_errors=True)
        raise AnalyticsError("testing the model took longer than 15 minutes and was stopped")
    result_file = folder / "result.json"
    if not result_file.is_file():
        shutil.rmtree(folder, ignore_errors=True)
        tail = (done.stderr or "").strip().splitlines()[-1:] or ["no details"]
        raise AnalyticsError(f"the model could not be tested ({tail[0][:300]})")
    result = json.loads(result_file.read_text(encoding="utf-8"))
    if not result.get("ok"):
        shutil.rmtree(folder, ignore_errors=True)
        raise AnalyticsError(result.get("error") or "the model could not be tested")
    report = result["report"]
    report.update(id=folder.name, name=name, created=int(time.time()), source=source)
    (folder / "report.json").write_text(json.dumps(report), encoding="utf-8")
    result_file.unlink()
    return report


def from_project(pid: str, model: str, split: str) -> dict[str, Any]:
    """Test one of a project's saved models on that project's own data."""
    path, meta = projects.project_dir(pid), projects.get(pid)
    if model not in meta["models"] or Path(model).suffix.lower() not in MODEL_TYPES:
        raise AnalyticsError("choose one of the project's .keras or .joblib models")
    if split not in ("held-out", "all"):
        raise AnalyticsError("split must be 'held-out' or 'all'")
    helpers = [str(path / "models" / name) for name in ("preprocess.joblib", "classes.txt")
               if (path / "models" / name).is_file() and name != model]
    if meta["kind"] == "csv":
        if not meta.get("data_file") or not meta.get("target"):
            raise AnalyticsError("this project has no data file or no column to predict yet")
        data = path / "data" / meta["data_file"]
    else:
        data = path / "data"
    job = {"kind": meta["kind"], "model": str(path / "models" / model), "helpers": helpers, "data": str(data),
           "target": meta.get("target"), "split": split}
    name = f"{meta['name']} · {model}"
    return _run(_new_dir(meta["name"]), name, job, {"project": pid, "project_name": meta["name"]})


def _unpack_images(source: BinaryIO, target: Path) -> int:
    """Unpack a zip of class folders. Entries are placed by their last two path parts only, so nothing can escape."""
    try:
        archive = zipfile.ZipFile(source)
    except zipfile.BadZipFile:
        raise AnalyticsError("the test data is not a valid zip archive")
    saved, total = 0, 0
    with archive:
        for info in archive.infolist():
            parts = [p for p in info.filename.replace("\\", "/").split("/") if p not in ("", ".", "..")]
            if info.is_dir() or "__MACOSX" in info.filename or len(parts) < 2 or Path(parts[-1]).suffix.lower() not in projects.IMAGE_TYPES:
                continue
            total += info.file_size
            if saved >= projects.MAX_IMAGES or info.file_size > projects.MAX_IMAGE_BYTES or total > projects.MAX_ZIP_TOTAL:
                raise AnalyticsError("the archive is too large to unpack")
            slot = target / projects._clean(parts[-2], "class") / projects._clean(parts[-1], "image")
            slot.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as member:
                projects._copy_limited(member, slot, projects.MAX_IMAGE_BYTES)
            saved += 1
    if saved == 0:
        raise AnalyticsError("no images found in the zip. Put each class in its own folder, e.g. cats/001.jpg")
    return saved


def from_upload(name: str, model: tuple[str, BinaryIO], helpers: list[tuple[str, BinaryIO]],
                data: tuple[str, BinaryIO], target: str | None) -> dict[str, Any]:
    """Test an uploaded model on uploaded data. Everything is copied into the report's own folder."""
    model_name = projects._clean(model[0], "model")
    if Path(model_name).suffix.lower() not in MODEL_TYPES:
        raise AnalyticsError("the model must be a .keras or .joblib file (.pt and .onnx are not supported yet)")
    data_name = projects._clean(data[0], "data")
    kind = {".csv": "csv", ".zip": "images"}.get(Path(data_name).suffix.lower())
    if kind is None:
        raise AnalyticsError("test data must be a .csv file, or a .zip with one folder of images per class")
    if kind == "csv" and not (target or "").strip():
        raise AnalyticsError("type the name of the column the model predicts")
    name = (name or "").strip()[:60] or Path(model_name).stem
    folder = _new_dir(name)
    try:
        upload = folder / "upload"
        upload.mkdir()
        projects._copy_limited(model[1], upload / model_name, MAX_MODEL_BYTES)
        helper_paths = []
        for helper_name, stream in helpers:
            helper_name = projects._clean(helper_name, "helper")
            if Path(helper_name).suffix.lower() not in HELPER_TYPES or helper_name == model_name:
                raise AnalyticsError("the extra file must be the preprocess .joblib or classes .txt saved with the model")
            projects._copy_limited(stream, upload / helper_name, MAX_HELPER_BYTES)
            helper_paths.append(str(upload / helper_name))
        if kind == "csv":
            projects._copy_limited(data[1], upload / data_name, projects.MAX_CSV_BYTES)
            data_path = upload / data_name
        else:
            data_path = upload / "images"
            data_path.mkdir()
            _unpack_images(data[1], data_path)
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    job = {"kind": kind, "model": str(upload / model_name), "helpers": helper_paths, "data": str(data_path),
           "target": (target or "").strip() or None, "split": "all"}
    return _run(folder, name, job, {"upload": True, "data_file": data_name})


def get(rid: str) -> dict[str, Any]:
    return json.loads((report_dir(rid) / "report.json").read_text(encoding="utf-8"))


def list_all() -> list[dict[str, Any]]:
    found = []
    for path in root().iterdir():
        try:
            report = json.loads((path / "report.json").read_text(encoding="utf-8"))
            found.append({"id": report["id"], "name": report["name"], "created": report["created"], "task": report["task"],
                          "kind": report["kind"], "tested": report["tested"], "headline": _headline(report)})
        except Exception:
            continue
    return sorted(found, key=lambda r: -r["created"])


def delete(rid: str) -> None:
    """Remove one report and the copies of files uploaded for it. Project files are never touched."""
    shutil.rmtree(report_dir(rid))


def sources() -> list[dict[str, Any]]:
    """Projects that have a model which can be tested."""
    out = []
    for meta in projects.list_all():
        models = [m for m in meta["models"] if Path(m).suffix.lower() in MODEL_TYPES and m != "preprocess.joblib"]
        if models:
            out.append({"id": meta["id"], "name": meta["name"], "kind": meta["kind"], "models": models})
    return out

"""Projects: a folder per project under workspace/projects with data, code and trained models."""
from __future__ import annotations

import io
import json
import re
import time
import zipfile
from pathlib import Path
from typing import Any, BinaryIO

from . import files, starters

IMAGE_TYPES = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp"}
MAX_CSV_BYTES = 300 * 1024 * 1024
MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_IMAGES = 20_000
MAX_ZIP_TOTAL = 2 * 1024 * 1024 * 1024
_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,60}$")
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._ -]+")


class ProjectError(ValueError):
    pass


def root() -> Path:
    path = files.root() / "projects"
    path.mkdir(parents=True, exist_ok=True)
    return path


def project_dir(pid: str) -> Path:
    if not _ID.match(pid or ""):
        raise ProjectError("unknown project")
    path = root() / pid
    if not (path / "project.json").is_file():
        raise ProjectError("unknown project")
    return path


def _clean(name: str, fallback: str) -> str:
    """A file or folder name with nothing that could escape its directory."""
    name = _SAFE_NAME.sub("_", Path(name.replace("\\", "/")).name).strip(" .")
    return name or fallback


def _write_meta(path: Path, meta: dict[str, Any]) -> None:
    (path / "project.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")


def create(name: str, kind: str) -> dict[str, Any]:
    name = name.strip()
    if not name or len(name) > 60:
        raise ProjectError("give the project a name of up to 60 characters")
    if kind not in ("csv", "images"):
        raise ProjectError("kind must be 'csv' or 'images'")
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "project"
    pid, n = base, 2
    while (root() / pid).exists():
        pid, n = f"{base}-{n}", n + 1
    path = root() / pid
    (path / "data").mkdir(parents=True)
    meta = {"id": pid, "name": name, "kind": kind, "created": int(time.time()), "target": None, "data_file": None}
    _write_meta(path, meta)
    return meta


def get(pid: str) -> dict[str, Any]:
    path = project_dir(pid)
    meta = json.loads((path / "project.json").read_text(encoding="utf-8"))
    meta["has_code"] = (path / "main.py").is_file()
    meta["models"] = sorted(p.name for p in (path / "models").glob("*") if p.is_file()) if (path / "models").is_dir() else []
    return meta


def list_all() -> list[dict[str, Any]]:
    found = []
    for path in sorted(root().iterdir()):
        if (path / "project.json").is_file():
            try:
                found.append(get(path.name))
            except Exception:
                continue
    return sorted(found, key=lambda m: -m.get("created", 0))


def _copy_limited(source: BinaryIO, target: Path, limit: int) -> int:
    written = 0
    with target.open("wb") as out:
        while chunk := source.read(1024 * 1024):
            written += len(chunk)
            if written > limit:
                out.close()
                target.unlink(missing_ok=True)
                raise ProjectError(f"file is larger than the {limit // (1024 * 1024)} MB limit")
            out.write(chunk)
    return written


def save_csv(pid: str, filename: str, source: BinaryIO) -> dict[str, Any]:
    path = project_dir(pid)
    meta = get(pid)
    if meta["kind"] != "csv":
        raise ProjectError("this project expects images, not a CSV file")
    name = _clean(filename, "data.csv")
    if not name.lower().endswith(".csv"):
        raise ProjectError("please upload a .csv file")
    for old in (path / "data").glob("*.csv"):
        old.unlink()
    _copy_limited(source, path / "data" / name, MAX_CSV_BYTES)
    meta.update(data_file=name, target=None)
    _write_meta(path, {k: meta[k] for k in ("id", "name", "kind", "created", "target", "data_file")})
    return get(pid)


def _image_slot(pid: str, relative: str) -> Path:
    """Where an uploaded image goes: data/<class folder>/<file>. The class is the image's parent folder."""
    parts = [p for p in relative.replace("\\", "/").split("/") if p not in ("", ".", "..")]
    if len(parts) < 2:
        raise ProjectError("images must be inside a folder named after their class, e.g. cats/001.jpg")
    label, name = _clean(parts[-2], "class"), _clean(parts[-1], "image")
    if Path(name).suffix.lower() not in IMAGE_TYPES:
        raise ProjectError("not an image file")
    target = project_dir(pid) / "data" / label / name
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def _image_count(pid: str) -> int:
    return sum(1 for p in (project_dir(pid) / "data").rglob("*") if p.suffix.lower() in IMAGE_TYPES)


def save_image(pid: str, relative: str, source: BinaryIO) -> None:
    if get(pid)["kind"] != "images":
        raise ProjectError("this project expects a CSV file, not images")
    if _image_count(pid) >= MAX_IMAGES:
        raise ProjectError(f"a project can hold at most {MAX_IMAGES:,} images")
    _copy_limited(source, _image_slot(pid, relative), MAX_IMAGE_BYTES)


def save_images_zip(pid: str, source: BinaryIO) -> int:
    """Unpack a zip of class folders. Entries are placed by their last two path parts only, so nothing can escape."""
    if get(pid)["kind"] != "images":
        raise ProjectError("this project expects a CSV file, not images")
    try:
        archive = zipfile.ZipFile(source)
    except zipfile.BadZipFile:
        raise ProjectError("that file is not a valid zip archive")
    saved, total, room = 0, 0, MAX_IMAGES - _image_count(pid)
    with archive:
        for info in archive.infolist():
            if info.is_dir() or "__MACOSX" in info.filename or Path(info.filename).suffix.lower() not in IMAGE_TYPES:
                continue
            if saved >= room:
                break
            total += info.file_size
            if info.file_size > MAX_IMAGE_BYTES or total > MAX_ZIP_TOTAL:
                raise ProjectError("the archive is too large to unpack")
            try:
                target = _image_slot(pid, info.filename)
            except ProjectError:
                continue  # image not inside a class folder
            with archive.open(info) as member:
                _copy_limited(member, target, MAX_IMAGE_BYTES)
            saved += 1
    if saved == 0:
        raise ProjectError("no images found. Put each class in its own folder, e.g. cats/001.jpg and dogs/001.jpg")
    return saved


def image_path(pid: str, relative: str) -> Path:
    base = (project_dir(pid) / "data").resolve()
    target = (base / relative).resolve()
    if not target.is_relative_to(base) or not target.is_file() or target.suffix.lower() not in IMAGE_TYPES:
        raise ProjectError("image not found")
    return target


# -- summaries ---------------------------------------------------------------
def _csv_summary(path: Path, meta: dict[str, Any]) -> dict[str, Any]:
    import numpy as np
    import pandas as pd

    file = path / "data" / (meta.get("data_file") or "")
    if not file.is_file():
        return {"ready": False}
    df = pd.read_csv(file, nrows=200_000, low_memory=False)
    columns = []
    for name in df.columns:
        series = df[name]
        info: dict[str, Any] = {
            "name": str(name), "missing": int(series.isna().sum()), "unique": int(series.nunique(dropna=True)),
        }
        values = series.dropna()
        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            info["type"] = "number"
            if len(values):
                finite = values.astype("float64")
                finite = finite[np.isfinite(finite)]
                counts, edges = np.histogram(finite, bins=12) if len(finite) else ([], [])
                info.update(min=float(finite.min()) if len(finite) else None, max=float(finite.max()) if len(finite) else None,
                            mean=float(finite.mean()) if len(finite) else None, hist=[int(c) for c in counts],
                            edges=[float(e) for e in edges])
        else:
            info["type"] = "category" if info["unique"] <= 50 else "text"
            top = values.astype(str).value_counts().head(6)
            info["top"] = [[str(k), int(v)] for k, v in top.items()]
        columns.append(info)
    head = df.head(8).astype(object).where(df.head(8).notna(), None)
    return {
        "ready": True, "file": file.name, "rows": int(len(df)), "columns": columns,
        "head": [[None if v is None else str(v) for v in row] for row in head.values.tolist()],
        "suggested_target": str(df.columns[-1]) if len(df.columns) else None,
    }


def _image_summary(path: Path) -> dict[str, Any]:
    from PIL import Image

    classes = []
    for folder in sorted(p for p in (path / "data").iterdir() if p.is_dir()):
        images = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_TYPES)
        if images:
            classes.append({"name": folder.name, "count": len(images), "samples": [f"{folder.name}/{p.name}" for p in images[:6]]})
    sizes = []
    for cls in classes:
        for sample in cls["samples"][:3]:
            try:
                with Image.open(path / "data" / sample) as image:
                    sizes.append(list(image.size))
            except Exception:
                continue
    return {"ready": bool(classes), "classes": classes, "total": sum(c["count"] for c in classes), "sizes": sizes[:12]}


def summary(pid: str) -> dict[str, Any]:
    path, meta = project_dir(pid), get(pid)
    return _csv_summary(path, meta) if meta["kind"] == "csv" else _image_summary(path)


# -- code, export ------------------------------------------------------------
def write_starter(pid: str, target: str | None, template: str) -> str:
    path, meta = project_dir(pid), get(pid)
    info = summary(pid)
    if not info.get("ready"):
        raise ProjectError("upload your data first")
    if meta["kind"] == "csv":
        column = next((c for c in info["columns"] if c["name"] == target), None)
        if column is None:
            raise ProjectError("choose which column the model should predict")
        task = "regression" if column["type"] == "number" and column["unique"] > 20 else "classification"
        code = starters.csv_code(meta["name"], info["file"], target, task, template)
        meta["target"] = target
    else:
        if len(info["classes"]) < 2:
            raise ProjectError("an image project needs at least two class folders")
        code = starters.image_code(meta["name"], len(info["classes"]))
    (path / "main.py").write_text(code, encoding="utf-8", newline="\n")
    _write_meta(path, {k: meta[k] for k in ("id", "name", "kind", "created", "target", "data_file")})
    return code


def export_zip(pid: str) -> io.BytesIO:
    """The whole project as a zip: code, data, settings and any trained models."""
    path = project_dir(pid)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for item in sorted(path.rglob("*")):
            if item.is_file() and "__pycache__" not in item.parts:
                archive.write(item, f"{pid}/{item.relative_to(path).as_posix()}")
    buffer.seek(0)
    return buffer


def notebook(pid: str) -> dict[str, Any]:
    """A Jupyter notebook that runs this project's code on Kaggle."""
    path, meta = project_dir(pid), get(pid)
    if not (path / "main.py").is_file():
        raise ProjectError("generate or write the training code first")
    code = (path / "main.py").read_text(encoding="utf-8")
    return starters.kaggle_notebook(meta, code)


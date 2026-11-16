"""Workspace file access. Every path is checked to stay inside the workspace."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(os.environ.get("MLE_WORKSPACE") or Path(__file__).resolve().parents[2] / "workspace")
MAX_LISTED = 500
MAX_READ_BYTES = 2_000_000
_SKIP_DIRS = {"__pycache__", ".ipynb_checkpoints", ".git"}


class BadPath(ValueError):
    pass


def root() -> Path:
    ROOT.mkdir(parents=True, exist_ok=True)
    return ROOT.resolve()


def safe_path(rel: str) -> Path:
    base = root()
    if not rel or "\x00" in rel:
        raise BadPath("empty path")
    target = (base / rel).resolve()
    if target == base or not target.is_relative_to(base):
        raise BadPath("path is outside the workspace")
    return target


def list_files() -> list[str]:
    base = root()
    found: list[str] = []
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = sorted(d for d in dirnames if d not in _SKIP_DIRS)
        for name in sorted(filenames):
            found.append((Path(dirpath) / name).relative_to(base).as_posix())
            if len(found) >= MAX_LISTED:
                return found
    return found


def read_file(rel: str) -> str:
    target = safe_path(rel)
    if not target.is_file():
        raise FileNotFoundError(rel)
    if target.stat().st_size > MAX_READ_BYTES:
        raise BadPath("file is too large to open in the editor")
    return target.read_text(encoding="utf-8", errors="replace")


def write_file(rel: str, content: str) -> None:
    target = safe_path(rel)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8", newline="\n")

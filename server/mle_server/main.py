"""ML-E engine server. Local only: it runs whatever Python the browser sends it."""
from __future__ import annotations

import asyncio
import os
import threading
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

from . import analytics, files, projects
from .kernel import KernelSession
from .parse import parse_model

ALLOWED_ORIGINS = {"http://localhost:3210", "http://127.0.0.1:3210"}
ALLOWED_HOSTS = {"127.0.0.1:8000", "localhost:8000", "testserver"}

session = KernelSession(warm=os.environ.get("MLE_NO_WARM") != "1")


def _prewarm() -> None:
    try:
        session.start()
    except Exception:
        pass  # the first Lab connection will retry and report the error


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Start warming the Python kernel now so the Lab is ready sooner.
    if os.environ.get("MLE_NO_PREWARM") != "1":
        threading.Thread(target=_prewarm, daemon=True).start()
    yield
    await asyncio.to_thread(session.shutdown)


app = FastAPI(title="ML-E engine", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=sorted(ALLOWED_ORIGINS), allow_methods=["*"], allow_headers=["*"],
)


@app.middleware("http")
async def local_only(request: Request, call_next):
    # Block other websites (and DNS-rebinding tricks) from driving the engine.
    if request.headers.get("host") not in ALLOWED_HOSTS:
        return JSONResponse({"detail": "unknown host"}, status_code=403)
    origin = request.headers.get("origin")
    if origin is not None and origin not in ALLOWED_ORIGINS:
        return JSONResponse({"detail": "origin not allowed"}, status_code=403)
    return await call_next(request)


class Code(BaseModel):
    code: str


class FileBody(BaseModel):
    path: str
    content: str


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "kernel": session.state}


@app.post("/api/parse")
def parse(body: Code) -> dict[str, Any]:
    return parse_model(body.code)


@app.get("/api/files")
def list_files() -> dict[str, Any]:
    return {"files": files.list_files()}


@app.get("/api/files/content")
def read_file(path: str) -> dict[str, Any]:
    try:
        return {"path": path, "content": files.read_file(path)}
    except files.BadPath as exc:
        raise HTTPException(400, str(exc))
    except FileNotFoundError:
        raise HTTPException(404, "file not found")


@app.put("/api/files/content")
def write_file(body: FileBody) -> dict[str, Any]:
    try:
        files.write_file(body.path, body.content)
    except files.BadPath as exc:
        raise HTTPException(400, str(exc))
    return {"ok": True}


# -- projects ----------------------------------------------------------------
class NewProject(BaseModel):
    name: str
    kind: str


class Starter(BaseModel):
    target: str | None = None
    template: str = "network"


def _project_call(action):
    try:
        return action()
    except projects.ProjectError as exc:
        raise HTTPException(400, str(exc))


@app.get("/api/projects")
def project_list() -> dict[str, Any]:
    return {"projects": projects.list_all()}


@app.post("/api/projects")
def project_create(body: NewProject) -> dict[str, Any]:
    return _project_call(lambda: projects.create(body.name, body.kind))


@app.get("/api/projects/{pid}")
def project_get(pid: str) -> dict[str, Any]:
    return _project_call(lambda: {"project": projects.get(pid), "summary": projects.summary(pid)})


@app.post("/api/projects/{pid}/upload")
def project_upload(pid: str, uploads: list[UploadFile] = File(...), paths: list[str] = Form(default=[])) -> dict[str, Any]:
    """CSV projects take one .csv. Image projects take one .zip, or image files with their folder paths."""
    def work() -> dict[str, Any]:
        kind = projects.get(pid)["kind"]
        saved, skipped = 0, 0
        if kind == "csv":
            projects.save_csv(pid, uploads[0].filename or "data.csv", uploads[0].file)
            saved = 1
        elif len(uploads) == 1 and (uploads[0].filename or "").lower().endswith(".zip"):
            saved = projects.save_images_zip(pid, uploads[0].file)
        else:
            for index, upload in enumerate(uploads):
                relative = paths[index] if index < len(paths) else (upload.filename or "")
                try:
                    projects.save_image(pid, relative, upload.file)
                    saved += 1
                except projects.ProjectError:
                    skipped += 1
            if saved == 0:
                raise projects.ProjectError(
                    "no images saved. Choose a folder that contains one sub-folder per class, e.g. cats/ and dogs/")
        return {"saved": saved, "skipped": skipped, "project": projects.get(pid), "summary": projects.summary(pid)}

    return _project_call(work)


@app.get("/api/projects/{pid}/image")
def project_image(pid: str, path: str) -> FileResponse:
    return FileResponse(_project_call(lambda: projects.image_path(pid, path)))


@app.post("/api/projects/{pid}/starter")
def project_starter(pid: str, body: Starter) -> dict[str, Any]:
    return _project_call(lambda: {"code": projects.write_starter(pid, body.target, body.template), "project": projects.get(pid)})


@app.get("/api/projects/{pid}/export")
def project_export(pid: str) -> StreamingResponse:
    buffer = _project_call(lambda: projects.export_zip(pid))
    return StreamingResponse(buffer, media_type="application/zip",
                             headers={"content-disposition": f'attachment; filename="{pid}.zip"'})


@app.get("/api/projects/{pid}/notebook")
def project_notebook(pid: str) -> Response:
    import json

    notebook = _project_call(lambda: projects.notebook(pid))
    return Response(json.dumps(notebook, indent=1), media_type="application/x-ipynb+json",
                    headers={"content-disposition": f'attachment; filename="{pid}-kaggle.ipynb"'})


# -- analytics ---------------------------------------------------------------
class ProjectRun(BaseModel):
    project: str
    model: str
    split: str = "held-out"


@app.get("/api/analytics")
def analytics_list() -> dict[str, Any]:
    return {"reports": analytics.list_all(), "projects": analytics.sources()}


@app.post("/api/analytics/project")
def analytics_project(body: ProjectRun) -> dict[str, Any]:
    return _project_call(lambda: analytics.from_project(body.project, body.model, body.split))


@app.post("/api/analytics/upload")
def analytics_upload(model: UploadFile = File(...), data: UploadFile = File(...), helpers: list[UploadFile] = File(default=[]),
                     name: str = Form(default=""), target: str = Form(default="")) -> dict[str, Any]:
    return _project_call(lambda: analytics.from_upload(
        name, (model.filename or "", model.file), [(h.filename or "", h.file) for h in helpers],
        (data.filename or "", data.file), target))


@app.get("/api/analytics/{rid}")
def analytics_get(rid: str) -> dict[str, Any]:
    return _project_call(lambda: analytics.get(rid))


@app.delete("/api/analytics/{rid}")
def analytics_delete(rid: str) -> dict[str, Any]:
    _project_call(lambda: analytics.delete(rid))
    return {"ok": True}


@app.websocket("/ws/kernel")
async def kernel_socket(ws: WebSocket) -> None:
    if ws.headers.get("origin") not in ALLOWED_ORIGINS or ws.headers.get("host") not in ALLOWED_HOSTS:
        await ws.close(code=1008)
        return
    await ws.accept()
    loop = asyncio.get_running_loop()
    outbox: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    def put(message: dict[str, Any] | None) -> None:
        loop.call_soon_threadsafe(outbox.put_nowait, message)

    def status() -> None:
        put({"type": "status", "state": session.state})

    def boot() -> None:
        try:
            session.start()
        except Exception as exc:
            put({"type": "error", "ename": "EngineStartFailed", "evalue": str(exc), "traceback": []})
        status()

    def run(code: str, folder: str) -> None:
        put({"type": "status", "state": "busy"})
        try:
            # Every run starts in a known folder: the workspace, or a project inside it.
            where = files.safe_path(folder) if folder else files.root()
            where.mkdir(parents=True, exist_ok=True)
            for message in session.execute(f"import os as _mle_os; _mle_os.chdir({str(where)!r}); del _mle_os"):
                if message["type"] == "error":
                    put(message)
            for message in session.execute(code):
                put(message)
        except Exception as exc:
            put({"type": "error", "ename": type(exc).__name__, "evalue": str(exc), "traceback": []})
            put({"type": "done"})
        status()

    def restart() -> None:
        put({"type": "status", "state": "starting"})
        try:
            session.restart()
        except Exception as exc:
            put({"type": "error", "ename": "EngineStartFailed", "evalue": str(exc), "traceback": []})
        status()

    async def sender() -> None:
        while (message := await outbox.get()) is not None:
            await ws.send_json(message)

    send_task = asyncio.create_task(sender())
    put({"type": "status", "state": "starting" if session.state == "dead" else session.state})
    threading.Thread(target=boot, daemon=True).start()
    try:
        while True:
            message = await ws.receive_json()
            kind = message.get("type")
            if kind == "execute" and isinstance(message.get("code"), str):
                folder = message.get("cwd") if isinstance(message.get("cwd"), str) else ""
                threading.Thread(target=run, args=(message["code"], folder), daemon=True).start()
            elif kind == "interrupt":
                await asyncio.to_thread(session.interrupt)
            elif kind == "restart":
                threading.Thread(target=restart, daemon=True).start()
    except WebSocketDisconnect:
        pass
    finally:
        put(None)
        await send_task

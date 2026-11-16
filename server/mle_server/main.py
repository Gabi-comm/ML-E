"""ML-E engine server. Local only: it runs whatever Python the browser sends it."""
from __future__ import annotations

import asyncio
import os
import threading
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import files
from .kernel import KernelSession
from .parse import parse_model

ALLOWED_ORIGINS = {"http://localhost:3210", "http://127.0.0.1:3210"}
ALLOWED_HOSTS = {"127.0.0.1:8000", "localhost:8000", "testserver"}

session = KernelSession(warm=os.environ.get("MLE_NO_WARM") != "1")


@asynccontextmanager
async def lifespan(_: FastAPI):
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

    def run(code: str) -> None:
        put({"type": "status", "state": "busy"})
        try:
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
                threading.Thread(target=run, args=(message["code"],), daemon=True).start()
            elif kind == "interrupt":
                await asyncio.to_thread(session.interrupt)
            elif kind == "restart":
                threading.Thread(target=restart, daemon=True).start()
    except WebSocketDisconnect:
        pass
    finally:
        put(None)
        await send_task

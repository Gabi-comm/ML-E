"""One long-lived Python kernel that runs the user's code and reports what happened."""
from __future__ import annotations

import os
import queue
import sys
import threading
from pathlib import Path
from typing import Any, Iterator

from jupyter_client.kernelspec import KernelSpec
from jupyter_client.manager import KernelManager

from . import files

MLE_MIME = "application/vnd.mle+json"
SERVER_DIR = Path(__file__).resolve().parents[1]  # contains the `mle` package

_STARTUP = """
import os as _os
_os.environ.setdefault("KERAS_BACKEND", "torch")
import mle as _mle
_mle.install(warm={warm})
del _os, _mle
"""


class KernelSession:
    def __init__(self, warm: bool = True) -> None:
        self.warm = warm
        self.km: KernelManager | None = None
        self.kc: Any = None
        self.state = "dead"
        self._run_lock = threading.Lock()
        self._life_lock = threading.Lock()

    # -- lifecycle ---------------------------------------------------------
    def start(self) -> None:
        with self._life_lock:
            if self.km is not None and self.km.is_alive():
                return
            self.state = "starting"
            km = KernelManager()
            # Launch the kernel with *this* environment's Python, not whatever
            # "python3" kernelspec happens to be registered on the machine.
            km._kernel_spec = KernelSpec(
                argv=[sys.executable, "-m", "ipykernel_launcher", "-f", "{connection_file}"],
                display_name="ML-E", language="python",
            )
            env = dict(os.environ)
            env["PYTHONPATH"] = os.pathsep.join(filter(None, [str(SERVER_DIR), env.get("PYTHONPATH")]))
            env["KERAS_BACKEND"] = "torch"
            env["PYTHONUNBUFFERED"] = "1"
            km.start_kernel(cwd=str(files.root()), env=env)
            kc = km.client()
            kc.start_channels()
            try:
                kc.wait_for_ready(timeout=90)
            except Exception:
                kc.stop_channels()
                km.shutdown_kernel(now=True)
                self.state = "dead"
                raise
            self.km, self.kc = km, kc
            for _ in self._run(_STARTUP.format(warm=self.warm)):
                pass
            self.state = "idle"

    def shutdown(self) -> None:
        with self._life_lock:
            if self.kc is not None:
                self.kc.stop_channels()
            if self.km is not None:
                self.km.shutdown_kernel(now=True)
            self.km = self.kc = None
            self.state = "dead"

    def restart(self) -> None:
        self.shutdown()
        self.start()

    def interrupt(self) -> None:
        if self.km is not None and self.km.is_alive():
            self.km.interrupt_kernel()

    # -- execution ---------------------------------------------------------
    def execute(self, code: str) -> Iterator[dict[str, Any]]:
        """Run code; yield protocol messages; always ends with {"type": "done"}."""
        if self.km is None or not self.km.is_alive():
            self.start()
        if not self._run_lock.acquire(blocking=False):
            yield {"type": "error", "ename": "Busy", "evalue": "Code is already running. Stop it first.", "traceback": []}
            yield {"type": "done"}
            return
        self.state = "busy"
        try:
            yield from self._run(code)
        finally:
            self.state = "idle" if self.km is not None and self.km.is_alive() else "dead"
            self._run_lock.release()
        yield {"type": "done"}

    def _run(self, code: str) -> Iterator[dict[str, Any]]:
        kc, km = self.kc, self.km
        msg_id = kc.execute(code, allow_stdin=False, stop_on_error=True)
        while True:
            try:
                msg = kc.get_iopub_msg(timeout=0.25)
            except queue.Empty:
                if not km.is_alive():
                    yield {"type": "error", "ename": "KernelDied",
                           "evalue": "The Python engine stopped (often out of memory). Restart it to continue.",
                           "traceback": []}
                    return
                continue
            if msg.get("parent_header", {}).get("msg_id") != msg_id:
                continue
            kind, content = msg["msg_type"], msg["content"]
            if kind == "status" and content.get("execution_state") == "idle":
                return
            if kind == "stream":
                yield {"type": "stream", "name": content["name"], "text": content["text"]}
            elif kind == "error":
                yield {"type": "error", "ename": content["ename"], "evalue": content["evalue"],
                       "traceback": content.get("traceback", [])}
            elif kind in ("display_data", "execute_result", "update_display_data"):
                data = content.get("data", {})
                if MLE_MIME in data:
                    yield {"type": "mle", "event": data[MLE_MIME]}
                elif "image/png" in data:
                    yield {"type": "image", "png": data["image/png"]}
                elif "text/html" in data:
                    yield {"type": "html", "html": data["text/html"]}
                elif data.get("text/plain"):
                    yield {"type": "stream", "name": "stdout", "text": data["text/plain"] + "\n"}

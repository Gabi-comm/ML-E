import threading
import time

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from mle_server import files, main
from mle_server.kernel import KernelSession

GOOD = {"origin": "http://localhost:3210"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(files, "ROOT", tmp_path)
    return TestClient(main.app)


def test_file_round_trip_and_listing(client):
    assert client.put("/api/files/content", json={"path": "lab/a.py", "content": "x = 1\n"}, headers=GOOD).status_code == 200
    assert client.get("/api/files/content", params={"path": "lab/a.py"}).json()["content"] == "x = 1\n"
    assert client.get("/api/files").json()["files"] == ["lab/a.py"]


@pytest.mark.parametrize("path", ["../x.py", "..\\x.py", "lab/../../x.py", "C:/Windows/x.py", ""])
def test_paths_outside_workspace_rejected(client, path):
    assert client.put("/api/files/content", json={"path": path, "content": "x"}, headers=GOOD).status_code == 400


def test_foreign_origin_blocked(client):
    r = client.put("/api/files/content", json={"path": "a.py", "content": "x"}, headers={"origin": "https://evil.example"})
    assert r.status_code == 403


def test_foreign_host_blocked(client):
    assert client.get("/api/health", headers={"host": "evil.example"}).status_code == 403


def test_parse_route(client):
    assert client.post("/api/parse", json={"code": "Dense(3)"}, headers=GOOD).json()["layers"][0]["units"] == 3


def test_websocket_refuses_foreign_origin(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/kernel", headers={"origin": "https://evil.example"}):
            pass


@pytest.fixture(scope="module")
def kernel():
    session = KernelSession(warm=False)
    session.start()
    yield session
    session.shutdown()


def test_print_streams_then_done(kernel):
    messages = list(kernel.execute("print('hi')"))
    assert {"type": "stream", "name": "stdout", "text": "hi\n"} in messages
    assert messages[-1] == {"type": "done"}


def test_error_is_reported(kernel):
    errors = [m for m in kernel.execute("1/0") if m["type"] == "error"]
    assert errors and errors[0]["ename"] == "ZeroDivisionError"


def test_mle_events_arrive(kernel):
    messages = list(kernel.execute("import mle; mle.emit({'kind': 'x'}); mle.log(loss=0.5)"))
    events = [m["event"] for m in messages if m["type"] == "mle"]
    assert events[0] == {"kind": "x"}
    assert events[1]["kind"] == "metrics" and events[1]["values"] == {"loss": 0.5}


def test_state_survives_between_runs(kernel):
    list(kernel.execute("answer = 41"))
    assert {"type": "stream", "name": "stdout", "text": "42\n"} in list(kernel.execute("print(answer + 1)"))


def test_interrupt_stops_infinite_loop(kernel):
    threading.Timer(1.0, kernel.interrupt).start()
    started = time.monotonic()
    messages = list(kernel.execute("while True: pass"))
    assert time.monotonic() - started < 6
    assert any(m["type"] == "error" and m["ename"] == "KeyboardInterrupt" for m in messages)
    assert kernel.state == "idle"

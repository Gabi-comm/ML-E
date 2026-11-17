import types

import pytest
from fastapi.testclient import TestClient

from mle_server import main, tutor
from mle_server.kernel import KernelSession

GOOD = {"origin": "http://localhost:3210"}


@pytest.fixture(scope="module")
def kernel():
    session = KernelSession(warm=False)
    session.start()
    yield session
    session.shutdown()


@pytest.fixture()
def client(kernel, monkeypatch):
    monkeypatch.setattr(main, "session", kernel)
    return TestClient(main.app)


def check(client, body, code=""):
    response = client.post("/api/check", json={"check": body, "code": code}, headers=GOOD)
    assert response.status_code == 200
    return response.json()


def test_check_sees_the_learners_variables(client, kernel):
    list(kernel.execute("import numpy as np\nX = np.ones((10, 3)) / 16"))
    body = 'X = need("X")\nassert X.shape == (10, 3), "wrong shape"\npraise = f"{len(X)} rows"'
    assert check(client, body) == {"ok": True, "message": "10 rows"}
    assert check(client, 'assert need("X").max() > 1, "Divide X by 16 only once."') == {"ok": False, "message": "Divide X by 16 only once."}


def test_check_reports_missing_names_and_crashes(client):
    result = check(client, 'need("model")')
    assert not result["ok"] and "model" in result["message"]
    result = check(client, "undefined_thing + 1")
    assert not result["ok"] and "undefined_thing" in result["message"]
    result = check(client, "1 / 0")
    assert not result["ok"] and "ZeroDivisionError" in result["message"]


def test_check_cannot_change_the_learners_variables(client, kernel):
    list(kernel.execute("counter = 1"))
    check(client, "counter = 99")
    assert {"type": "stream", "name": "stdout", "text": "1\n"} in list(kernel.execute("print(counter)"))


def test_check_helpers(client, kernel):
    list(kernel.execute("from sklearn.linear_model import LogisticRegression\nraw = LogisticRegression()\nfit = LogisticRegression().fit([[0],[1],[2],[3]], [0,0,1,1])"))
    body = 'assert len(instances("LogisticRegression")) == 2\nassert len(instances("LogisticRegression", fitted=True)) == 1\nassert wrote("model.fit( X , y )")'
    assert check(client, body, code="model.fit(X,y)")["ok"]
    assert not check(client, 'assert wrote("evaluate("), "call evaluate"', code="model.fit(X, y)")["ok"]


def test_ask_status_and_errors(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.setattr(tutor.Path, "home", lambda: tutor.Path("/nonexistent-home"))
    monkeypatch.setattr(tutor, "ENV_FILES", [])
    assert client.get("/api/ask").json()["ai"] is False
    assert client.post("/api/ask", json={"question": "  "}, headers=GOOD).status_code == 400


def test_env_file_supplies_the_key(tmp_path, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_BASE_URL", raising=False)
    monkeypatch.setenv("ANTHROPIC_MODEL_HINT", "from-shell")
    env = tmp_path / ".env"
    env.write_text('# my key\nexport ANTHROPIC_API_KEY="sk-test-123"\nANTHROPIC_MODEL_HINT=from-file\nOTHER=x\n', encoding="utf-8")
    monkeypatch.setattr(tutor, "ENV_FILES", [env, tmp_path / "missing.env"])
    try:
        assert tutor.available()
        assert tutor.os.environ["ANTHROPIC_API_KEY"] == "sk-test-123"
        assert tutor.os.environ["ANTHROPIC_MODEL_HINT"] == "from-shell"   # a real env var wins
        assert tutor.os.environ.get("OTHER") != "x"                       # only ANTHROPIC_* settings are read
    finally:
        tutor.os.environ.pop("ANTHROPIC_API_KEY", None)


def test_ask_sends_context_and_returns_text(client, monkeypatch):
    sent = {}

    class FakeMessages:
        def create(self, **kwargs):
            sent.update(kwargs)
            return types.SimpleNamespace(stop_reason="end_turn", content=[
                types.SimpleNamespace(type="thinking", thinking=""), types.SimpleNamespace(type="text", text="ReLU keeps positives.")])

    fake = types.SimpleNamespace(beta=types.SimpleNamespace(messages=FakeMessages()))
    monkeypatch.setattr(tutor, "_client", lambda: fake)
    body = {"question": "what is relu", "code": "layers.Dense(8, activation='relu')", "context": "Step 4",
            "error": "", "history": [{"q": "what is dense", "a": "A layer."}]}
    response = client.post("/api/ask", json=body, headers=GOOD)
    assert response.status_code == 200 and response.json() == {"answer": "ReLU keeps positives."}
    assert sent["model"] == "claude-opus-5-5" and sent["fallbacks"] == "default"
    assert [m["role"] for m in sent["messages"]] == ["user", "assistant", "user"]
    last = sent["messages"][-1]["content"]
    assert "<their_code>" in last and "Step 4" in last and last.endswith("Question: what is relu")


def test_ask_refusal_is_reported(client, monkeypatch):
    fake = types.SimpleNamespace(beta=types.SimpleNamespace(messages=types.SimpleNamespace(
        create=lambda **_: types.SimpleNamespace(stop_reason="refusal", content=[]))))
    monkeypatch.setattr(tutor, "_client", lambda: fake)
    response = client.post("/api/ask", json={"question": "x"}, headers=GOOD)
    assert response.status_code == 400 and "declined" in response.json()["detail"]


def test_foreign_origin_cannot_check_or_ask(client):
    evil = {"origin": "https://evil.example"}
    assert client.post("/api/check", json={"check": "1"}, headers=evil).status_code == 403
    assert client.post("/api/ask", json={"question": "x"}, headers=evil).status_code == 403

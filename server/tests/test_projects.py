import io
import json
import zipfile

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from mle_server import files, main

GOOD = {"origin": "http://localhost:3210"}
CSV = "size,rooms,city,price\n" + "\n".join(
    f"{50 + i},{1 + i % 4},{'Manila' if i % 2 else 'Cebu'},{100 + i * 3.5}" for i in range(60)
)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(files, "ROOT", tmp_path)
    return TestClient(main.app)


def png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), (200, 30, 30)).save(buffer, "PNG")
    return buffer.getvalue()


def new(client, name="House prices", kind="csv"):
    response = client.post("/api/projects", json={"name": name, "kind": kind}, headers=GOOD)
    assert response.status_code == 200
    return response.json()["id"]


def test_create_and_list(client):
    first = new(client)
    second = new(client)  # same name gets a different id
    assert first == "house-prices" and second == "house-prices-2"
    assert [p["id"] for p in client.get("/api/projects").json()["projects"]] == [second, first] or \
        {p["id"] for p in client.get("/api/projects").json()["projects"]} == {first, second}


@pytest.mark.parametrize("body", [{"name": "", "kind": "csv"}, {"name": "x", "kind": "video"}, {"name": "x" * 61, "kind": "csv"}])
def test_create_rejects_bad_input(client, body):
    assert client.post("/api/projects", json=body, headers=GOOD).status_code == 400


def test_unknown_or_unsafe_project_id(client):
    assert client.get("/api/projects/nope").status_code == 400
    assert client.get("/api/projects/..%2F..").status_code in (400, 404)


def test_csv_upload_summary_and_starter(client):
    pid = new(client)
    upload = client.post(f"/api/projects/{pid}/upload", files={"uploads": ("../../evil.csv", CSV, "text/csv")}, headers=GOOD)
    assert upload.status_code == 200
    summary = upload.json()["summary"]
    assert summary["file"] == "evil.csv" and summary["rows"] == 60          # path stripped from the name
    assert not (files.ROOT / "evil.csv").exists()
    by_name = {c["name"]: c for c in summary["columns"]}
    assert by_name["size"]["type"] == "number" and len(by_name["size"]["hist"]) == 12
    assert by_name["city"]["type"] == "category" and dict(by_name["city"]["top"]) == {"Manila": 30, "Cebu": 30}
    assert summary["suggested_target"] == "price"

    code = client.post(f"/api/projects/{pid}/starter", json={"target": "price"}, headers=GOOD).json()["code"]
    assert "loss=\"mse\"" in code and "'price'" in code                       # many distinct numbers: regression
    compile(code, "main.py", "exec")
    code = client.post(f"/api/projects/{pid}/starter", json={"target": "city"}, headers=GOOD).json()["code"]
    assert "sparse_categorical_crossentropy" in code
    compile(code, "main.py", "exec")
    code = client.post(f"/api/projects/{pid}/starter", json={"target": "city", "template": "forest"}, headers=GOOD).json()["code"]
    assert "RandomForestClassifier" in code
    compile(code, "main.py", "exec")
    assert client.post(f"/api/projects/{pid}/starter", json={"target": "missing"}, headers=GOOD).status_code == 400


def test_csv_project_refuses_other_files(client):
    pid = new(client)
    assert client.post(f"/api/projects/{pid}/upload", files={"uploads": ("notes.txt", "hi", "text/plain")}, headers=GOOD).status_code == 400


def test_image_zip_is_unpacked_safely(client):
    pid = new(client, "Pets", "images")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for i in range(3):
            archive.writestr(f"pets/cats/c{i}.png", png())
            archive.writestr(f"pets/dogs/d{i}.png", png())
        archive.writestr("../../../outside/escape.png", png())   # zip-slip attempt
        archive.writestr("pets/readme.txt", "not an image")
    response = client.post(f"/api/projects/{pid}/upload", files={"uploads": ("pets.zip", buffer.getvalue(), "application/zip")}, headers=GOOD)
    assert response.status_code == 200
    summary = response.json()["summary"]
    assert {c["name"]: c["count"] for c in summary["classes"]} == {"cats": 3, "dogs": 3, "outside": 1}
    data = files.ROOT / "projects" / pid / "data"
    assert all(p.resolve().is_relative_to(data.resolve()) for p in files.ROOT.rglob("*.png"))
    assert client.get(f"/api/projects/{pid}/image", params={"path": "cats/c0.png"}).status_code == 200
    assert client.get(f"/api/projects/{pid}/image", params={"path": "../project.json"}).status_code == 400

    code = client.post(f"/api/projects/{pid}/starter", json={}, headers=GOOD).json()["code"]
    assert "Conv2D" in code
    compile(code, "main.py", "exec")


def test_image_files_with_folder_paths(client):
    pid = new(client, "Pets", "images")
    response = client.post(
        f"/api/projects/{pid}/upload",
        files=[("uploads", ("a.png", png(), "image/png")), ("uploads", ("b.png", png(), "image/png")), ("uploads", ("loose.png", png(), "image/png"))],
        data={"paths": ["set/cats/a.png", "set/dogs/b.png", "loose.png"]},
        headers=GOOD,
    )
    assert response.status_code == 200 and response.json()["saved"] == 2 and response.json()["skipped"] == 1


def test_export_zip_and_notebook(client):
    pid = new(client)
    client.post(f"/api/projects/{pid}/upload", files={"uploads": ("homes.csv", CSV, "text/csv")}, headers=GOOD)
    assert client.get(f"/api/projects/{pid}/notebook").status_code == 400   # no code yet
    client.post(f"/api/projects/{pid}/starter", json={"target": "price"}, headers=GOOD)

    archive = zipfile.ZipFile(io.BytesIO(client.get(f"/api/projects/{pid}/export").content))
    assert {f"{pid}/main.py", f"{pid}/data/homes.csv", f"{pid}/project.json"} <= set(archive.namelist())

    notebook = json.loads(client.get(f"/api/projects/{pid}/notebook").content)
    assert notebook["nbformat"] == 4 and [c["cell_type"] for c in notebook["cells"]] == ["markdown", "code", "code"]
    setup = "".join(notebook["cells"][1]["source"])
    assert "homes.csv" in setup and "/kaggle/input" in setup
    compile(setup, "setup", "exec")
    compile("".join(notebook["cells"][2]["source"]), "main", "exec")


def test_foreign_origin_cannot_create(client):
    assert client.post("/api/projects", json={"name": "x", "kind": "csv"}, headers={"origin": "https://evil.example"}).status_code == 403

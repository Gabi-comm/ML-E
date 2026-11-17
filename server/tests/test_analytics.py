import io
import json
import zipfile

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from mle_server import evaluate, files, main

GOOD = {"origin": "http://localhost:3210"}


def table(n=120, seed=0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    size = rng.uniform(40, 200, n)
    city = rng.choice(["Manila", "Cebu"], n)
    price = size * 3 + (city == "Manila") * 50 + rng.normal(0, 5, n)
    kind = np.where(size > 140, "big", np.where(size > 90, "mid", "small"))
    return pd.DataFrame({"size": size.round(1), "city": city, "price": price.round(1), "kind": kind})


def prepare_for(df: pd.DataFrame, numeric: list[str]):
    return ColumnTransformer([("numbers", StandardScaler(), numeric),
                              ("categories", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["city"])]).fit(df)


def classifier(tmp_path, df):
    X = df.drop(columns=["kind"])
    prepare = prepare_for(X, ["size", "price"])
    classes = sorted(df["kind"].unique())
    y = df["kind"].map({c: i for i, c in enumerate(classes)})
    model = RandomForestClassifier(n_estimators=20, random_state=0).fit(prepare.transform(X), y)
    joblib.dump({"model": model, "prepare": prepare, "classes": classes}, tmp_path / "model.joblib")
    df.to_csv(tmp_path / "data.csv", index=False)
    return {"kind": "csv", "model": str(tmp_path / "model.joblib"), "helpers": [], "data": str(tmp_path / "data.csv"),
            "target": "kind", "split": "held-out"}


def test_classification_report(tmp_path):
    report = evaluate.run(classifier(tmp_path, table()))
    assert report["task"] == "classification" and report["tested"] == 24 and report["available"] == 120   # the 20% split
    result = report["classification"]
    assert result["classes"] == ["big", "mid", "small"] and result["accuracy"] > 0.9
    assert np.sum(result["matrix"]) == 24 and len(result["per_class"]) == 3
    assert sum(b["right"] + b["wrong"] for b in result["sure"]) == 24
    assert all(len(c["roc"][0]) == len(c["roc"][1]) and 0.5 < c["auc"] <= 1 for c in result["curves"])
    assert result["wrong_total"] == len(result["wrong"]) or len(result["wrong"]) == 12
    assert report["model"]["importances"]["items"][0][0] == "size"          # the label is made from size
    json.dumps(report)                                                       # everything is plain JSON


def test_all_rows_and_wrong_examples(tmp_path):
    job = classifier(tmp_path, table())
    flipped = table()
    flipped.loc[:9, "kind"] = "small"                                        # make some labels disagree with the model
    flipped.loc[:9, "size"] = 199.0
    flipped.to_csv(tmp_path / "data.csv", index=False)
    report = evaluate.run({**job, "split": "all"})
    assert report["tested"] == 120
    worst = report["classification"]["wrong"][0]
    assert worst["actual"] == "small" and worst["predicted"] == "big" and worst["where"].startswith("row ")
    assert dict(worst["row"])["size"] == "199.0"


def test_regression_report(tmp_path):
    df = table().drop(columns=["kind"])
    X = df.drop(columns=["price"])
    prepare = prepare_for(X, ["size"])
    model = RandomForestRegressor(n_estimators=20, random_state=0).fit(prepare.transform(X), df["price"])
    joblib.dump({"model": model, "prepare": prepare}, tmp_path / "model.joblib")
    df.to_csv(tmp_path / "data.csv", index=False)
    report = evaluate.run({"kind": "csv", "model": str(tmp_path / "model.joblib"), "helpers": [], "data": str(tmp_path / "data.csv"),
                           "target": "price", "split": "all"})
    result = report["regression"]
    assert report["task"] == "regression" and result["r2"] > 0.9 and result["mae"] < result["baseline_mae"]
    assert len(result["points"]) == 120 and sum(result["errors"]["counts"]) == 120 and len(result["worst"]) == 10


def test_helpful_errors(tmp_path):
    job = classifier(tmp_path, table())
    with pytest.raises(evaluate.EvalError, match="no column named"):
        evaluate.run({**job, "target": "nope"})
    joblib.dump({"prepare": None}, tmp_path / "empty.joblib")
    with pytest.raises(evaluate.EvalError, match="without a 'model'"):
        evaluate.run({**job, "model": str(tmp_path / "empty.joblib")})
    with pytest.raises(evaluate.EvalError, match="only .keras and .joblib"):
        evaluate.run({**job, "model": str(tmp_path / "model.onnx")})


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(files, "ROOT", tmp_path)
    return TestClient(main.app)


def test_project_model_through_the_api(client, tmp_path):
    pid = client.post("/api/projects", json={"name": "Homes", "kind": "csv"}, headers=GOOD).json()["id"]
    df = table()
    client.post(f"/api/projects/{pid}/upload", files={"uploads": ("homes.csv", df.to_csv(index=False), "text/csv")}, headers=GOOD)
    client.post(f"/api/projects/{pid}/starter", json={"target": "kind", "template": "forest"}, headers=GOOD)
    models = tmp_path / "projects" / pid / "models"
    models.mkdir()
    job = classifier(tmp_path / "projects" / pid / "models", df)             # writes model.joblib there
    (models / "data.csv").unlink()
    assert job

    listing = client.get("/api/analytics").json()
    assert listing["reports"] == [] and listing["projects"] == [{"id": pid, "name": "Homes", "kind": "csv", "models": ["model.joblib"]}]
    assert client.post("/api/analytics/project", json={"project": pid, "model": "../project.json"}, headers=GOOD).status_code == 400

    response = client.post("/api/analytics/project", json={"project": pid, "model": "model.joblib"}, headers=GOOD)
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["tested"] == 24 and report["source"]["project"] == pid and report["name"] == "Homes · model.joblib"

    listed = client.get("/api/analytics").json()["reports"]
    assert [r["id"] for r in listed] == [report["id"]] and listed[0]["headline"]["label"] == "accuracy"
    assert client.get(f"/api/analytics/{report['id']}").json()["classification"]["accuracy"] == report["classification"]["accuracy"]

    assert client.delete(f"/api/analytics/{report['id']}", headers=GOOD).status_code == 200
    assert client.get(f"/api/analytics/{report['id']}").status_code == 400
    assert (models / "model.joblib").is_file()                               # deleting a report leaves the project alone


def test_upload_through_the_api(client, tmp_path):
    work = tmp_path / "make"
    work.mkdir()
    classifier(work, table())
    files_ = {"model": ("../model.joblib", (work / "model.joblib").read_bytes()), "data": ("test.csv", (work / "data.csv").read_bytes())}
    missing = client.post("/api/analytics/upload", files=files_, data={"name": "Mine"}, headers=GOOD)
    assert missing.status_code == 400 and "column" in missing.json()["detail"]
    response = client.post("/api/analytics/upload", files=files_, data={"name": "Mine", "target": "kind"}, headers=GOOD)
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["tested"] == 120 and report["source"]["upload"] and report["name"] == "Mine"
    assert not (tmp_path / "model.joblib").exists()                          # path stripped from the file name

    bad = client.post("/api/analytics/upload", files={**files_, "model": ("model.pt", b"x")}, data={"target": "kind"}, headers=GOOD)
    assert bad.status_code == 400 and ".keras or .joblib" in bad.json()["detail"]
    wrong = client.post("/api/analytics/upload", files=files_, data={"target": "nope"}, headers=GOOD)
    assert wrong.status_code == 400 and "no column named" in wrong.json()["detail"]
    assert len(list((tmp_path / "analytics").iterdir())) == 1                # failed runs leave nothing behind

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("notes.txt", "no images here")
    empty = client.post("/api/analytics/upload", files={**files_, "data": ("pics.zip", buffer.getvalue())}, headers=GOOD)
    assert empty.status_code == 400 and "no images" in empty.json()["detail"]


def test_foreign_origin_cannot_run_or_delete(client):
    evil = {"origin": "https://evil.example"}
    assert client.post("/api/analytics/project", json={"project": "x", "model": "m"}, headers=evil).status_code == 403
    assert client.delete("/api/analytics/anything", headers=evil).status_code == 403

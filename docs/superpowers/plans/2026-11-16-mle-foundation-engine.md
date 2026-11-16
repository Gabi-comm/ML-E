# ML-E Foundation + Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phases 0 and 1 of ML-E: a themed Next.js shell with five sections and a working Lab where Python code on the left drives a live 3D network and charts on the right.

**Architecture:** `web/` is a Next.js app; `server/` is a FastAPI process that owns one Jupyter kernel. The browser sends code over a WebSocket; the server streams kernel output back as typed JSON messages. A small in-kernel library (`mle`) publishes training events through a custom display MIME type.

**Tech Stack:** Next.js (App Router, TS, Tailwind), React Three Fiber, Monaco, FastAPI, jupyter_client, Keras 3 on PyTorch, Python 3.12 via uv, pnpm.

**Spec:** `docs/ML-E-plan.md`

## Global Constraints

- Server binds `127.0.0.1:8000` only; WebSocket and CORS accept only origins `http://localhost:3210` and `http://127.0.0.1:3210` (port 3000 is used by another app on this PC).
- Python 3.12 environment managed by `uv` in `server/`.
- `KERAS_BACKEND=torch` in the kernel.
- Theme: background `#000`, foreground `#fff`, dot grid, square pixels; colour only for meaning (positive `#7CFFB2`, negative `#FF5C7A`).
- No book text is copied into the app.
- User files live under `workspace/`; file API must refuse paths outside it.

## Review Focus

- Code with a syntax error while typing: 3D view keeps the last good model, no crash.
- Long-running or infinite code: Interrupt stops it and the UI returns to idle.
- Server not running: Lab shows "engine offline" with the start command, not a blank screen.
- Very wide layers (e.g. 4096 units): 3D view caps drawn nodes and labels the real count.
- A foreign website trying to open the kernel WebSocket: rejected by origin check.

## File map

| File | Responsibility |
|---|---|
| `package.json` | `pnpm dev` starts web and server together |
| `server/pyproject.toml` | Python deps |
| `server/mle_server/parse.py` | `parse_model(code) -> dict` static model extraction |
| `server/mle_server/kernel.py` | `KernelSession`: start, execute (yields messages), interrupt, restart |
| `server/mle_server/files.py` | safe workspace file list/read/write |
| `server/mle_server/main.py` | FastAPI routes: `/api/health`, `/api/parse`, `/api/files`, `/ws/kernel` |
| `server/mle/__init__.py` | in-kernel helpers: `emit`, `install`, Keras live callback |
| `server/tests/` | pytest for parse, files, kernel, origin check |
| `web/app/layout.tsx`, `globals.css` | theme shell |
| `web/components/Nav.tsx`, `DotGrid.tsx`, `BloomHero.tsx` | theme pieces |
| `web/app/page.tsx` | Home |
| `web/app/{books,lab,projects,analytics}/page.tsx` | sections (Lab real; others mapped, marked as upcoming) |
| `web/lib/books.ts` | chapter map for both books |
| `web/lib/engine.ts` | WebSocket client + message types + `useEngine` hook |
| `web/components/studio/*` | `Studio`, `CodeEditor`, `Console`, `Network3D`, `LossChart`, `OutputPanel` |

## Message protocol (server → browser)

`{type:"status",state:"starting"|"idle"|"busy"|"dead"}` · `{type:"stream",name,text}` · `{type:"error",ename,evalue,traceback}` · `{type:"image",png}` · `{type:"html",html}` · `{type:"mle",event}` · `{type:"done"}`

Browser → server: `{type:"execute",code}` · `{type:"interrupt"}` · `{type:"restart"}`

`mle` events: `{kind:"model",layers:[{name,type,units,activation,params,shape}]}` · `{kind:"batch",step,loss}` · `{kind:"epoch",epoch,epochs,logs,weights:[{layer,w:number[][]}]}` · `{kind:"train_end"}`

`parse_model` returns `{ok:bool, error?:str, layers:[{type,units,activation,line}]}` with `units` null when not statically known.

## Tasks

### Task 1: Scaffold
- [ ] `git init`, `.gitignore`, root `package.json` with `dev` script (concurrently: `pnpm -C web dev` and `uv run --project server uvicorn mle_server.main:app --host 127.0.0.1 --port 8000`).
- [ ] `create-next-app` into `web/`; add three, @react-three/fiber, @react-three/drei, @monaco-editor/react.
- [ ] `uv init` in `server/` pinned to 3.12; add fastapi, uvicorn[standard], jupyter_client, ipykernel, numpy, pandas, scikit-learn, matplotlib, keras, torch, pytest, httpx.
- [ ] Verify: `pnpm -C web build` passes; `uv run pytest` collects.

### Task 2: Static model parser (TDD)
- [ ] Tests in `server/tests/test_parse.py`: Sequential list form → 3 layers with units 64/32/10 and activations; `model.add(...)` form; `Input(shape=(784,))` gives units 784; Conv2D reports `units` = filters; `nn.Sequential(nn.Linear(4,8), nn.ReLU())`; syntax error → `ok False` with `error`; no model → `ok True, layers []`.
- [ ] Implement `parse_model` with `ast`.

### Task 3: Files API (TDD)
- [ ] Tests: write then read round-trips; `../x.py` rejected with 400; list returns relative paths.
- [ ] Implement `files.py` and routes.

### Task 4: Kernel session + `mle` library (TDD)
- [ ] Tests: `print("hi")` yields a stream message then done; `1/0` yields error with `ename == "ZeroDivisionError"`; `mle.emit({"kind":"x"})` yields an `mle` message; interrupt stops `while True: pass` within 5 s.
- [ ] Implement `KernelSession` with blocking client in a worker thread; kernel startup sets backend, imports `mle`, calls `mle.install()` (patches `keras.Model.fit` to add the live callback).
- [ ] WebSocket route with origin check; test that a bad origin is refused.

### Task 5: Theme, nav, Home, section shells
- [ ] `globals.css` tokens, `DotGrid`, `Nav`, `BloomHero` (canvas: square pixels sized by a growing noisy blob, like the reference video), Home copy, section pages, `books.ts` chapter map.
- [ ] Verify in browser at desktop and mobile widths.

### Task 6: Studio (Lab)
- [ ] `engine.ts` client with reconnect and offline state.
- [ ] `CodeEditor` (Monaco, themed), `Console`, `LossChart`, `OutputPanel`, `Network3D` (instanced cubes per layer, capped at 16 drawn nodes per layer with real count label, lines weighted by `w`).
- [ ] Debounced `/api/parse` on edit keeps last good model on error.
- [ ] Starter examples: MLP on digits (Keras), scikit-learn classifier, pandas table.
- [ ] Verify end to end in browser: type a layer → node layer appears; Run → loss curve and weights animate; Interrupt works; server stopped → offline notice.

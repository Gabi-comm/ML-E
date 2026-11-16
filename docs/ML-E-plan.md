# ML-E — build plan

*Drafted 2026-11-16 for Gab. Nothing has been built yet; this is the plan to approve or correct.*

## 1. What ML-E is

A local learning studio for machine learning and AI engineering, built for someone who loses focus reading long text. Every idea from the two books becomes something you can see and poke at, and every line of code you write shows up as a picture next to it.

- **Why:** reading the two books straight through does not hold your attention. Short visual scenes, immediate feedback, and "type it, watch it" loops do.
- **Runs on:** your own PC (`localhost`). Next.js for the interface, Python for running real ML code.
- **Success looks like:** you can open a chapter, understand the idea from an interactive 3D/2D scene in a few minutes, practise it in the Lab, then build and train your own project on your own data.

### Not in scope (first version)
- No accounts, no cloud hosting, no multi-user. It is a single-user app on your machine.
- No copy of the books' text. ML-E uses original explanations and visuals organised by the books' chapters and sections, with page references back to your PDFs. (Copying the text would also defeat the purpose.)
- Not a replacement for VS Code. The built-in IDE is for practice and ML projects, not general development.

## 2. What I found before planning

| Thing | Finding | Effect on the plan |
|---|---|---|
| Book 1 | *AI Engineering* — 10 chapters (foundation models, evaluation, prompting, RAG & agents, finetuning, datasets, inference, architecture) | 10 chapter modules, mostly system/flow visuals |
| Book 2 | *Hands-On ML*, Géron, 3rd edition — 19 chapters in two parts (classic ML, then neural networks) | 19 chapter modules, mostly math/geometry/network visuals. The contents pages did not extract cleanly from the PDF, so the chapter list below is from the 3rd edition and gets re-checked against your file in Phase 2. |
| Theme video | Pure black background, white square "pixels" on a fine dot grid, forming a shape that grows outward like a bloom. Monochrome, no colour. | Whole app is black/white dot-matrix. Colour is used only as a data signal (e.g. positive vs negative weights). |
| Target folder | `Documents\GitHub\Neuro` is empty, not a git repo | Fresh project; I will `git init` it |
| Your PC | Node 24, pnpm, uv, Python 3.13/3.14, RTX 2050 (4 GB) | Python ML libraries lag behind 3.14, so the backend gets its own Python 3.12 environment via `uv`. Your GPU can train small models locally. |
| Kaggle | The Kaggle API can upload a dataset, push a notebook with GPU switched on, and download its output files. Free GPU is about 30 hours/week, sessions up to about 12 hours. It does **not** offer a live interactive GPU session that an outside app can drive. Based on third-party write-ups; I did not find the official docs page, and status/log polling still needs confirming. | See section 6 — "connect directly" becomes "send job, watch status, pull results", with export as the fallback |

## 3. Approaches considered

**A. Local Python backend with a real Jupyter kernel (recommended).**
Next.js talks to a FastAPI server that runs your code in a real Python kernel. You get real scikit-learn, Keras, PyTorch, pandas, your own files, and your GPU. Visuals stream to the browser over a WebSocket.
*Trade-off:* two processes to start (one command handles it); only works on your machine.

**B. Python inside the browser (Pyodide).**
No backend. Simple to start, but no PyTorch/TensorFlow, no GPU, slow on real datasets. It would cover maybe a third of Book 2 and make sections 4 and 5 impossible.

**C. Wrap JupyterLab in an iframe.**
Fast to stand up, but the code-to-visual link you asked for would be bolted on, and the theme could not match.

**Choice: A.** It is the only one that satisfies "Next.js and Python", real training, and live visuals together.

## 4. Tech stack (my calls)

| Layer | Choice | Why |
|---|---|---|
| Interface | Next.js (App Router) + TypeScript + Tailwind | What you asked for |
| 3D | React Three Fiber (three.js) | Nodes, layers, weights, embeddings in 3D |
| 2D charts | D3 + Canvas | Loss curves, decision boundaries, confusion matrices |
| Code editor | Monaco (the VS Code editor) | Real IDE feel, Python highlighting, autocomplete |
| Backend | FastAPI + WebSocket, Python 3.12 via `uv` | Streams output while code runs |
| Code execution | Jupyter kernel (`jupyter_client`) | Real Python, variables persist between runs |
| ML libraries | scikit-learn, pandas, **Keras 3 on the PyTorch backend** | Géron's book teaches Keras; TensorFlow has no GPU support on Windows, but Keras 3 on PyTorch runs the same code on your RTX 2050 |
| Storage | Files on disk under `Neuro/workspace/` | Projects stay as plain folders you can open anywhere |

## 5. The "write code, see it" engine

This is the core feature and is shared by the Lab and Projects sections. Three levels, from instant to deep:

1. **While typing (no run needed).** The backend parses your code and finds model definitions (`keras.Sequential`, layers, `nn.Module`). The 3D network on the right rebuilds as you type: add a `Dense(64)` line and a 64-node layer appears.
2. **When you run.** A small helper library (`mle`) hooks into training. Each epoch it streams loss, accuracy, weights, and activations. The 3D network animates: connections brighten or dim by weight, nodes pulse by activation, and the loss curve draws live.
3. **Automatic picture for whatever you made.** DataFrame → table with distributions. Fitted scikit-learn classifier → decision boundary. Tree → tree diagram. Clustering → 3D scatter. Matplotlib plot → shown as is. Anything else → printed output.

```
┌────────────────────────── ML-E ─────────────────────────────┐
│ Home   Books   Lab   Projects   Analytics                   │
├──────────────────────────────┬──────────────────────────────┤
│ files │ model.py             │      ○ ○ ○                   │
│       │                      │    ○ ○ ○ ○ ○     3D network  │
│       │ model = Sequential([ │      ○ ○ ○       (rotatable) │
│       │   Dense(64, "relu"), │        ○                     │
│       │   Dense(10)          ├──────────────────────────────┤
│       │ ])                   │ loss ╲__      acc  __╱       │
│       ├──────────────────────┤                              │
│       │ console / errors     │ layer inspector              │
└───────┴──────────────────────┴──────────────────────────────┘
        IDE (left)                 live visualisation (right)
```

## 6. The five sections

You wrote "4 sections" and then described a fifth (model analytics), so the plan has five.

### 6.1 Home
What ML-E is, shown rather than told. The hero is the theme video's effect rebuilt in code: white pixels on a dot grid that bloom into a 3D neural network you can rotate. Below it: continue where you left off, progress per book, and one-click entry to each section.

### 6.2 Books — the two books, visualised
- One module per chapter (29 total), each split into short **scenes**: one idea, one interactive visual, two or three sentences, one "try it" control. Built for short attention: a scene takes 1–3 minutes.
- Each scene has **Open in Lab**, which loads matching starter code.
- Progress tracking, and a quick recall question at the end of each chapter.

**Book 2 — Hands-On ML (examples of the visual per chapter)**

| Ch | Topic | Main visual |
|---|---|---|
| 1 | ML landscape | Map of ML types; overfitting vs underfitting slider |
| 2 | End-to-end project | Animated pipeline over the housing data |
| 3 | Classification | Digit grid, threshold slider driving precision/recall and ROC |
| 4 | Training models | 3D loss surface with gradient descent ball; learning-rate slider |
| 5 | SVMs | Margin and support vectors; kernel lifting 2D data into 3D |
| 6 | Decision trees | Tree growing split by split next to the region it carves |
| 7 | Ensembles | Many trees voting; boosting correcting errors round by round |
| 8 | Dimensionality reduction | 3D point cloud projected by PCA; swiss roll unrolling |
| 9 | Unsupervised | K-means centroids moving; DBSCAN; Gaussian mixtures |
| 10 | Neural nets with Keras | 3D perceptron to MLP, forward pass animation |
| 11 | Training deep nets | Vanishing gradients through layers; optimizers racing |
| 12 | Custom models/training | Computation graph and gradient tape step-through |
| 13 | Data loading/preprocessing | Data pipeline as a conveyor |
| 14 | CNNs | 3D conv filter sliding over an image; feature-map stacks |
| 15 | RNNs for sequences | Network unrolling through time |
| 16 | NLP and attention | Attention lines between tokens; transformer block in 3D |
| 17 | Autoencoders, GANs, diffusion | Latent-space walk; noise-to-image steps |
| 18 | Reinforcement learning | Agent learning in a grid world with value heatmap |
| 19 | Deploying at scale | Serving and scaling flow |

**Book 1 — AI Engineering**

| Ch | Topic | Main visual |
|---|---|---|
| 1 | Building with foundation models | The AI stack in layers; tokens being predicted |
| 2 | Understanding foundation models | Transformer in 3D; temperature / top-k / top-p sampling playground |
| 3 | Evaluation methodology | Entropy and perplexity meters; embedding space in 3D |
| 4 | Evaluating AI systems | Model selection funnel; cost vs latency vs quality |
| 5 | Prompt engineering | Context window filling up; prompt injection walk-through |
| 6 | RAG and agents | Query → retrieve → generate flow; agent plan/tool/memory loop |
| 7 | Finetuning | LoRA matrices; quantization shrinking numbers; memory math |
| 8 | Dataset engineering | Curate → synthesise → dedupe → clean pipeline |
| 9 | Inference optimization | Batching, latency metrics, pruning and distillation |
| 10 | Architecture and feedback | System assembled step by step: context, guardrails, router, cache, agents |

"Apply everything the books include" means every chapter and every section heading gets at least one scene. Depth comes in passes (see phases) rather than all at once.

### 6.3 Lab — guided practice
IDE on the left, live visualisation on the right (section 5 engine). Activities are tied to chapters: a goal, starter code, hints that unlock one at a time, and a check that tells you when you have it. Plus a free-play mode with an empty file.

### 6.4 Projects — your own data, your own model
1. **New project:** choose **Image dataset** (folder or zip, one folder per class) or **CSV file**.
2. **Explore:** CSV → column types, missing values, distributions, correlations. Images → class balance, sample grid, sizes.
3. **Build:** same split screen. Starter code is generated for your data type; the 3D model updates as you edit.
4. **Train — three targets:**
   - **Local** — on your RTX 2050, with live visuals. Good for small models.
   - **Kaggle GPU** — you paste your Kaggle API token into Settings once (stored only on your PC; I never see or enter it). ML-E uploads your dataset as a private Kaggle dataset, pushes your code as a GPU notebook, shows its status, and pulls back the trained model, metrics, and logs when it finishes. Visuals replay from the returned training log rather than streaming epoch by epoch, because Kaggle gives no live session to outside apps.
   - **Export** — a ready-to-upload `.ipynb` plus dataset zip, if the direct route fails or you prefer doing it by hand.
5. **Export project:** zip of code, notebook, config, and trained model.

### 6.5 Analytics — upload a model, see how it did
- Upload a model (`.keras`, `.pt`/`.pth`, `.onnx`, scikit-learn `.joblib`) plus test data.
- **Classification:** confusion matrix, per-class precision/recall/F1, ROC and PR curves, the examples it got most wrong.
- **Regression:** predicted vs actual, residuals, error distribution.
- **The model itself:** 3D architecture, parameter count per layer, weight distributions, activations for one chosen input.
- Compare two models side by side.

*Safety note:* `.pt` and `.joblib` files can run code when opened. ML-E will only load them from your own machine and will say so in the upload dialog.

## 7. Theme

- Black `#000` background with a faint dot grid everywhere; white square pixels as the building block for buttons, loaders, charts, and transitions.
- Page transitions and loading states use the video's bloom: pixels spreading outward from a centre.
- Monospace type for labels and code, one clean sans for reading text.
- 3D nodes are small white cubes/points; layers are planes of them; connections are thin lines whose brightness is the weight.
- Colour appears only to carry meaning (one accent for positive, one for negative/error).
- Reduced-motion setting, because constant animation can also break focus.

## 8. Build phases

Each phase ends with something you can open and use.

| Phase | What you get | Size |
|---|---|---|
| 0. Foundation | Project scaffold, one start command, theme, navigation, Home with bloom hero | Small |
| 1. Engine | Monaco IDE + Python kernel + live 3D network + live charts (section 5). Everything else depends on this. | Large |
| 2. Books v1 | Scene framework, full chapter/section map for both books, 3 flagship chapters fully built (Géron 4 and 10, AI Eng 2) | Large |
| 3. Lab | Activity format, checks, hints, about 10 activities | Medium |
| 4. Projects | Upload, explore, build, local training, export | Large |
| 5. Kaggle | Token setup, dataset upload, GPU job, status, results back | Medium |
| 6. Analytics | Model upload, metrics, 3D model inspection, compare | Medium |
| 7. Books — the rest | Remaining 26 chapters, in batches of 4–5 | Very large, ongoing |

Phase 7 is the bulk of the work. Doing 29 chapters well is many sessions; doing them all at once would give shallow scenes.

## 9. Open decisions for Gab

1. **Chapter order for Phase 7.** My default: Géron Part I → Géron Part II → AI Engineering, since the second book assumes the first. Tell me if you want AI Engineering sooner.
2. **Keras on PyTorch.** Lets the book's Keras code use your GPU on Windows. A few TensorFlow-only chapters (12, 13, 19) would be shown as visuals with read-only code rather than runnable labs. The alternative is real TensorFlow, CPU only.
3. **Kaggle behaviour.** "Send job, watch status, pull results" is what the API allows. If you expected a live GPU session inside ML-E, that is not available from Kaggle.

## 10. Risks

- **Scope.** This is five products in one. The phases keep each one usable on its own.
- **4 GB GPU.** Fine for the books' examples, too small for large image models; that is what the Kaggle target is for.
- **Kaggle API details** (status and log polling) are unconfirmed and get tested first thing in Phase 5.
- **Running your own code** means the kernel can do anything on your PC that you can. Acceptable for a local single-user app; it must never be exposed to the internet.

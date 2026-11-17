"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export type Quiz = { question: string; options: string[]; answer: number; why: string };
export type Scene = {
  id: string;
  /** the part of the book chapter this scene belongs to */
  section: string;
  title: string;
  /** original explanation, a few sentences at most */
  text: string;
  /** something to do with the picture */
  tryIt: string;
  Visual: ComponentType;
  /** starter code for "Open in Lab" */
  lab?: string;
};
export type ChapterScenes = { scenes: Scene[]; quiz: Quiz };

const load = <T extends object>(loader: () => Promise<T>, name: keyof T) =>
  dynamic(() => loader().then((m) => m[name] as ComponentType), {
    ssr: false,
    loading: () => <p className="label p-4">Loading scene…</p>,
  });

const h1 = () => import("@/components/scenes/homl1");
const h3 = () => import("@/components/scenes/homl3");
const h5 = () => import("@/components/scenes/homl5");
const h6 = () => import("@/components/scenes/homl6");
const h2 = () => import("@/components/scenes/homl2");
const h7 = () => import("@/components/scenes/homl7");
const h8 = () => import("@/components/scenes/homl8");
const h9 = () => import("@/components/scenes/homl9");
const h11 = () => import("@/components/scenes/homl11");
const h14 = () => import("@/components/scenes/homl14");
const h15 = () => import("@/components/scenes/homl15");
const h16 = () => import("@/components/scenes/homl16");
const h12 = () => import("@/components/scenes/homl12");
const h13 = () => import("@/components/scenes/homl13");
const h17 = () => import("@/components/scenes/homl17");
const h18 = () => import("@/components/scenes/homl18");
const h19 = () => import("@/components/scenes/homl19");
const aA = () => import("@/components/scenes/aieA");
const aB = () => import("@/components/scenes/aieB");
const aC = () => import("@/components/scenes/aieC");
const h4 = () => import("@/components/scenes/homl4");
const h10 = () => import("@/components/scenes/homl10");
const a2 = () => import("@/components/scenes/aie2");

const PolyRidge = dynamic(() => h4().then((m) => function Ridge() { return <m.PolyFit ridge />; }), { ssr: false });
const SamplerFull = dynamic(() => a2().then((m) => function Full() { return <m.Sampler truncation />; }), { ssr: false });

const LAB_GRADIENT_DESCENT = `# Gradient descent by hand: watch the loss fall in the Training panel.
import numpy as np
import mle

rng = np.random.default_rng(42)
X = 2 * rng.random(100)
y = 4 + 3 * X + rng.normal(size=100)

theta0, theta1 = 0.0, 0.0        # start with a flat line
eta = 0.1                         # learning rate: try 0.01, then 0.5

for step in range(100):
    error = theta0 + theta1 * X - y
    grad0 = 2 * error.mean()
    grad1 = 2 * (error * X).mean()
    theta0 -= eta * grad0
    theta1 -= eta * grad1
    mle.log(step=step, loss=(error ** 2).mean())

print(f"intercept {theta0:.2f}, slope {theta1:.2f}  (true values: 4 and 3)")
`;

const LAB_MLP = `# A multilayer perceptron in Keras. Change the layers and watch the 3D view.
import keras
from keras import layers
from sklearn.datasets import make_moons

X, y = make_moons(n_samples=600, noise=0.2, random_state=0)

model = keras.Sequential([
    layers.Input(shape=(2,)),
    layers.Dense(8, activation="relu"),
    layers.Dense(8, activation="relu"),
    layers.Dense(1, activation="sigmoid"),
])
model.compile(optimizer=keras.optimizers.Adam(0.02),
              loss="binary_crossentropy", metrics=["accuracy"])
model.fit(X, y, epochs=40, batch_size=32, validation_split=0.2)
`;

const LAB_SAMPLING = `# Temperature, top-k and top-p on a tiny vocabulary.
import numpy as np

tokens = ["mat", "floor", "couch", "bed", "roof", "table", "grass", "keyboard", "moon", "piano"]
logits = np.array([4.1, 3.6, 3.3, 3.0, 2.4, 2.2, 1.9, 1.2, 0.3, 0.1])

def sample(temperature=1.0, top_k=None, top_p=1.0, n=12, seed=0):
    p = np.exp((logits - logits.max()) / temperature)
    p /= p.sum()
    order = np.argsort(-p)
    keep = np.zeros_like(p, dtype=bool)
    mass = 0.0
    for rank, i in enumerate(order):
        if (top_k is None or rank < top_k) and (mass < top_p or rank == 0):
            keep[i] = True
        mass += p[i]
    p = np.where(keep, p, 0)
    p /= p.sum()
    return list(np.random.default_rng(seed).choice(tokens, size=n, p=p))

print("cold  (T=0.2):", sample(temperature=0.2))
print("normal (T=1): ", sample(temperature=1.0))
print("hot   (T=2):  ", sample(temperature=2.0))
print("top-k = 3:    ", sample(top_k=3))
print("top-p = 0.7:  ", sample(top_p=0.7))
`;

const LAB_CLASSIFIER_METRICS = `# Precision, recall and the confusion matrix for a "is it a 5?" classifier.
from sklearn.datasets import load_digits
from sklearn.linear_model import SGDClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, precision_score, recall_score

X, y = load_digits(return_X_y=True)
y_is_5 = (y == 5)
X_train, X_test, y_train, y_test = train_test_split(X, y_is_5, random_state=42)

clf = SGDClassifier(random_state=42).fit(X_train, y_train)
scores = clf.decision_function(X_test)

for threshold in [-400, 0, 400]:          # move the threshold and watch the trade-off
    predicted = scores > threshold
    print(f"threshold {threshold:>5}:",
          f"precision {precision_score(y_test, predicted):.2f}",
          f"recall {recall_score(y_test, predicted):.2f}")

print(confusion_matrix(y_test, scores > 0))
`;

const LAB_SVM = `# Soft-margin SVM: try C=0.01, 1 and 100, then change the kernel's gamma.
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import make_moons
from sklearn.svm import SVC

X, y = make_moons(n_samples=200, noise=0.2, random_state=0)
clf = SVC(kernel="rbf", C=1, gamma=1).fit(X, y)
print("support vectors:", len(clf.support_vectors_), " accuracy:", clf.score(X, y))

xx, yy = np.meshgrid(np.linspace(-2, 3, 200), np.linspace(-1.5, 2, 200))
zz = clf.decision_function(np.c_[xx.ravel(), yy.ravel()]).reshape(xx.shape)
plt.contourf(xx, yy, zz, levels=20, cmap="gray")
plt.contour(xx, yy, zz, levels=[-1, 0, 1], colors="white", linestyles=["--", "-", "--"])
plt.scatter(X[:, 0], X[:, 1], c=y, cmap="cool", s=14)
plt.show()
`;

const LAB_TREE = `# Grow a decision tree and compare training accuracy with new-data accuracy.
import matplotlib.pyplot as plt
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, plot_tree

X, y = load_iris(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)

for depth in [1, 2, 3, None]:              # None = grow until every leaf is pure
    tree = DecisionTreeClassifier(max_depth=depth, random_state=42).fit(X_train, y_train)
    print(f"depth {depth}: train {tree.score(X_train, y_train):.2f}  test {tree.score(X_test, y_test):.2f}")

plot_tree(DecisionTreeClassifier(max_depth=2, random_state=42).fit(X_train, y_train), filled=False)
plt.show()
`;

const LAB_FIRST_MODEL = `# Two ways to predict: remember the examples, or fit a model.
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.neighbors import KNeighborsRegressor

rng = np.random.default_rng(4)
X = rng.random((26, 1)) * 10
y = 2 + 0.6 * X[:, 0] + rng.normal(scale=0.9, size=26)

new_x = [[6.3]]
print("nearest neighbours:", KNeighborsRegressor(n_neighbors=3).fit(X, y).predict(new_x))
print("fitted line:       ", LinearRegression().fit(X, y).predict(new_x))
`;

const LAB_PIPELINE = `# A full preparation pipeline: fill gaps, encode categories, scale, then train.
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

df = pd.DataFrame({
    "rooms":    [880, 7099, 1467, 1274, 2535, 919],
    "income":   [8.3, 8.3, None, 5.6, 3.8, None],
    "location": ["near bay", "near bay", "inland", "near ocean", "inland", "near ocean"],
    "price":    [452, 358, 352, 341, 342, 269],
})

prepare = ColumnTransformer([
    ("numbers", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), ["rooms", "income"]),
    ("places", OneHotEncoder(), ["location"]),
])
print(pd.DataFrame(prepare.fit_transform(df), columns=prepare.get_feature_names_out()).round(2))

model = make_pipeline(prepare, LinearRegression()).fit(df, df["price"])
print("predictions:", model.predict(df).round(0))
`;

const LAB_FOREST = `# One tree against a forest of them, on the same data.
from sklearn.datasets import make_moons
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

X, y = make_moons(n_samples=500, noise=0.3, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)

models = {
    "one tree":          DecisionTreeClassifier(random_state=42),
    "random forest":     RandomForestClassifier(n_estimators=200, random_state=42),
    "gradient boosting": GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, random_state=42),
}
for name, model in models.items():
    model.fit(X_train, y_train)
    print(f"{name:18} train {model.score(X_train, y_train):.2f}   new data {model.score(X_test, y_test):.2f}")
`;

const LAB_PCA = `# PCA on the 64-pixel digits: how many directions hold most of the information?
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import load_digits
from sklearn.decomposition import PCA

X, y = load_digits(return_X_y=True)
pca = PCA().fit(X)
kept = np.cumsum(pca.explained_variance_ratio_)
print("directions needed for 95% of the variance:", int(np.argmax(kept >= 0.95)) + 1, "of 64")

flat = PCA(n_components=2).fit_transform(X)
plt.scatter(flat[:, 0], flat[:, 1], c=y, cmap="tab10", s=6)
plt.title("1,797 digits squeezed from 64 dimensions to 2")
plt.show()
`;

const LAB_CLUSTER = `# K-means and DBSCAN on the same crescent-shaped data.
import matplotlib.pyplot as plt
from sklearn.cluster import DBSCAN, KMeans
from sklearn.datasets import make_moons

X, _ = make_moons(n_samples=400, noise=0.06, random_state=0)
kmeans = KMeans(n_clusters=2, n_init=10, random_state=0).fit(X)
dbscan = DBSCAN(eps=0.2, min_samples=5).fit(X)
print("k-means inertia:", round(kmeans.inertia_, 1))
print("DBSCAN clusters:", len(set(dbscan.labels_) - {-1}), " noise points:", (dbscan.labels_ == -1).sum())

fig, axes = plt.subplots(1, 2, figsize=(9, 3.5))
axes[0].scatter(X[:, 0], X[:, 1], c=kmeans.labels_, cmap="cool", s=8); axes[0].set_title("k-means")
axes[1].scatter(X[:, 0], X[:, 1], c=dbscan.labels_, cmap="cool", s=8); axes[1].set_title("DBSCAN")
plt.show()
`;

const LAB_DEEP = `# A deeper network with the usual training aids: He init, batch norm, dropout, Adam.
import keras
from keras import layers
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split

X, y = load_digits(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X / 16.0, y, random_state=42)

model = keras.Sequential([
    layers.Input(shape=(64,)),
    layers.Dense(64, activation="relu", kernel_initializer="he_normal"),
    layers.BatchNormalization(),
    layers.Dropout(0.3),                 # try 0.0 and 0.6
    layers.Dense(32, activation="relu", kernel_initializer="he_normal"),
    layers.Dense(10, activation="softmax"),
])
model.compile(optimizer=keras.optimizers.Adam(1e-3),   # swap for keras.optimizers.SGD(1e-2)
              loss="sparse_categorical_crossentropy", metrics=["accuracy"])
model.fit(X_train, y_train, epochs=30, batch_size=32, validation_data=(X_test, y_test))
`;

const LAB_CNN = `# A small convolutional network on 8x8 digit images.
import keras
from keras import layers
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split

X, y = load_digits(return_X_y=True)
X = (X / 16.0).reshape(-1, 8, 8, 1)          # height, width, 1 channel
X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)

model = keras.Sequential([
    layers.Input(shape=(8, 8, 1)),
    layers.Conv2D(16, 3, padding="same", activation="relu"),
    layers.MaxPooling2D(2),
    layers.Conv2D(32, 3, padding="same", activation="relu"),
    layers.MaxPooling2D(2),
    layers.Flatten(),
    layers.Dense(10, activation="softmax"),
])
model.summary()
model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
model.fit(X_train, y_train, epochs=20, batch_size=32, validation_data=(X_test, y_test))
`;

const LAB_RNN = `# Forecast the next value of a seasonal series with an LSTM.
import numpy as np
import keras
from keras import layers

rng = np.random.default_rng(12)
t = np.arange(600)
series = 10 + 0.01 * t + 3 * np.sin(2 * np.pi * t / 12) + rng.normal(scale=0.6, size=600)
series = (series - series.mean()) / series.std()

window = 24                                   # look at 24 steps, predict the next one
X = np.array([series[i:i + window] for i in range(len(series) - window)])[..., None]
y = series[window:]
split = 480

model = keras.Sequential([
    layers.Input(shape=(window, 1)),
    layers.LSTM(32),                          # swap for layers.SimpleRNN(32) and compare
    layers.Dense(1),
])
model.compile(optimizer="adam", loss="mse")
model.fit(X[:split], y[:split], epochs=25, batch_size=32, validation_data=(X[split:], y[split:]))
`;

const LAB_AUTOENCODER = `# An autoencoder squeezes 64 pixels through 8 numbers and rebuilds them.
import keras
from keras import layers
import matplotlib.pyplot as plt
from sklearn.datasets import load_digits

X = load_digits().data / 16.0

autoencoder = keras.Sequential([
    layers.Input(shape=(64,)),
    layers.Dense(32, activation="relu"),
    layers.Dense(8, activation="relu"),        # the bottleneck: try 2, 8, 32
    layers.Dense(32, activation="relu"),
    layers.Dense(64, activation="sigmoid"),
])
autoencoder.compile(optimizer="adam", loss="mse")
autoencoder.fit(X, X, epochs=40, batch_size=32, validation_split=0.1)   # input and target are the same

rebuilt = autoencoder.predict(X[:8], verbose=0)
fig, axes = plt.subplots(2, 8, figsize=(9, 2.6))
for i in range(8):
    axes[0, i].imshow(X[i].reshape(8, 8), cmap="gray"); axes[0, i].axis("off")
    axes[1, i].imshow(rebuilt[i].reshape(8, 8), cmap="gray"); axes[1, i].axis("off")
plt.show()
`;

const LAB_CUSTOM_LOOP = `# A training loop written by hand, here with PyTorch's automatic differentiation.
import torch
import mle

torch.manual_seed(0)
X = torch.rand(200, 1) * 4 - 2
y = 2 * X + 1 + torch.randn(200, 1) * 0.3

w = torch.zeros(1, requires_grad=True)
b = torch.zeros(1, requires_grad=True)

for step in range(100):
    batch = torch.randint(0, 200, (16,))          # 1. take a batch
    prediction = w * X[batch] + b                 # 2. forward pass
    loss = ((prediction - y[batch]) ** 2).mean()  # 3. measure the loss
    loss.backward()                               # 4. compute gradients
    with torch.no_grad():                         # 5. update the weights
        w -= 0.1 * w.grad
        b -= 0.1 * b.grad
        w.grad.zero_(); b.grad.zero_()
    mle.log(step=step, loss=loss.item())

print(f"w = {w.item():.2f} (target 2), b = {b.item():.2f} (target 1)")
`;

const LAB_PERPLEXITY = `# Entropy and perplexity of a next-word prediction.
import numpy as np

def describe(name, probabilities):
    p = np.array(probabilities)
    entropy = -(p * np.log2(p)).sum()
    print(f"{name:12} entropy {entropy:.2f} bits   perplexity {2 ** entropy:.2f}")

describe("very sure",  [0.97, 0.01, 0.01, 0.01])
describe("leaning",    [0.60, 0.20, 0.10, 0.10])
describe("clueless",   [0.25, 0.25, 0.25, 0.25])   # perplexity 4: four equal choices
`;

const LAB_RETRIEVAL = `# A tiny retriever: score documents against a question with TF-IDF.
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

docs = [
    "Refunds are available within 30 days of purchase with a receipt.",
    "Our store opens at 9am and closes at 8pm on weekdays.",
    "Shipping to provincial addresses takes five to seven working days.",
    "Refunds for digital purchases are not available after download.",
    "Weekend opening hours are 10am to 6pm.",
]
question = "Can I get a refund for a digital purchase?"

vectorizer = TfidfVectorizer(stop_words="english")
doc_vectors = vectorizer.fit_transform(docs)
scores = cosine_similarity(vectorizer.transform([question]), doc_vectors)[0]

for score, doc in sorted(zip(scores, docs), reverse=True)[:3]:   # top 3 go into the prompt
    print(f"{score:.2f}  {doc}")
`;

const LAB_LORA = `# How many numbers LoRA trains compared with full finetuning.
def lora_report(width, rank):
    full = width * width              # one weight matrix
    lora = 2 * width * rank           # the two thin matrices A and B
    print(f"width {width:5}, rank {rank:2}: full {full:>12,}  LoRA {lora:>9,}  ({100 * lora / full:.2f}%)")

for width in [768, 2048, 4096]:
    for rank in [4, 16, 64]:
        lora_report(width, rank)
`;

export const SCENES: Record<string, ChapterScenes> = {
  "homl-1": {
    scenes: [
      {
        id: "labels", section: "Types of Machine Learning Systems", title: "Learning with answers, and without",
        text: "In supervised learning every training example comes with the right answer, and the model learns to reproduce it. In unsupervised learning there are no answers at all: the algorithm can only look for structure, such as groups of similar points.",
        tryIt: "Switch to without labels and press Find groups. Watch the three markers walk into the clusters on their own.",
        Visual: load(h1, "Labels"),
      },
      {
        id: "instance", section: "Instance-Based Versus Model-Based Learning", title: "Remember the examples, or fit a rule",
        text: "There are two broad ways to generalise. Instance-based learning keeps the examples and answers a new case by looking at the most similar ones. Model-based learning squeezes the examples into a simple rule, here a line, and then uses only the rule.",
        tryIt: "Slide the new x across both modes. With k = 1 the neighbour prediction jumps around; with the line it moves smoothly.",
        Visual: load(h1, "InstanceVsModel"), lab: LAB_FIRST_MODEL,
      },
      {
        id: "data", section: "Main Challenges of Machine Learning", title: "Bad data beats a good algorithm",
        text: "A model only knows what its training data shows it. Too few examples and it is at the mercy of chance. A sample that leaves out part of reality (sampling bias) is worse: more of it does not help, because the missing part is still missing.",
        tryIt: "With 6 random examples, draw several samples and watch the green curve swing. Raise to 100. Then choose biased and see that even 200 examples fail.",
        Visual: load(h1, "SampleQuality"),
      },
      {
        id: "holdout", section: "Testing and Validating", title: "Keep some data the model never sees",
        text: "The only honest way to know how a model will do on new cases is to hold some data back and test on it. Training error flatters the model. But a small test set gives a noisy score, which is why results are often averaged over several splits.",
        tryIt: "At 5% held back, shuffle ten times and watch the score wobble on the right. Raise to 30% and shuffle again.",
        Visual: load(h1, "Holdout"),
      },
    ],
    quiz: {
      question: "You train on 10,000 photos taken in daylight and the model fails at night. More daylight photos will…",
      options: ["Fix it, because more data always helps", "Not fix it, because the sample is biased", "Fix it only if you also use a bigger model", "Cause underfitting"],
      answer: 1,
      why: "The training data does not represent the cases you care about. Adding more of the same leaves the gap exactly where it was.",
    },
  },
  "homl-2": {
    scenes: [
      {
        id: "map", section: "Working with Real Data · Look at the Big Picture", title: "A machine learning project has eight steps",
        text: "Training a model is one step out of eight. Most of the work, and most of the ways to fail, sit in the steps around it: asking the right question, getting and cleaning data, and watching the model after launch.",
        tryIt: "Step through all eight. For each one, read what goes wrong if you skip it.",
        Visual: load(h2, "ProjectMap"),
      },
      {
        id: "clean", section: "Prepare the Data · Clean the Data, Handling Text and Categorical Attributes", title: "Real tables are not ready for a model",
        text: "Most algorithms need a grid of numbers with no holes. Real data has missing values and text categories. Filling gaps with the median and turning each category into its own 0-or-1 column (one-hot encoding) are the standard repairs.",
        tryIt: "Apply the three fixes one at a time and watch each column change. The table is ready only when all red is gone.",
        Visual: load(h2, "CleanTable"), lab: LAB_PIPELINE,
      },
      {
        id: "scale", section: "Feature Scaling and Transformation", title: "Why features need the same ruler",
        text: "If one feature runs into the thousands and another only up to 14, anything that measures distance will listen to the big one and ignore the small one. Scaling puts every feature on a comparable range so each gets a fair say.",
        tryIt: "On raw, the points collapse onto a line and income has almost no say. Switch to min-max or standardized and see the nearest neighbour change.",
        Visual: load(h2, "Scaling"), lab: LAB_PIPELINE,
      },
      {
        id: "search", section: "Fine-Tune Your Model · Grid Search, Randomized Search", title: "Searching for the best settings",
        text: "Models have settings you choose before training. Grid search tries every combination and scores each with cross-validation. Random search tries a sample instead, which is far cheaper and often lands close to the best.",
        tryIt: "Run the grid search and note how many models it trained. Then run random search a few times and compare the best error it finds.",
        Visual: load(h2, "GridSearch"),
      },
    ],
    quiz: {
      question: "When should you set the test set aside?",
      options: ["After choosing the best model", "Before exploring the data in detail", "After scaling the features", "Only when the dataset is large"],
      answer: 1,
      why: "If you study the full data first, patterns you notice in the test rows leak into your choices, and the final score flatters the model.",
    },
  },
  "homl-3": {
    scenes: [
      {
        id: "threshold", section: "Performance Measures · Confusion Matrix", title: "Four ways to be right or wrong",
        text: "A classifier gives each example a score, and a threshold turns scores into yes or no. That creates four outcomes. Precision asks: of everything I flagged, how much was real? Recall asks: of everything real, how much did I catch?",
        tryIt: "Move the threshold right until there are no false alarms, and check how many you now miss. Then go the other way.",
        Visual: load(h3, "Threshold"), lab: LAB_CLASSIFIER_METRICS,
      },
      {
        id: "curves", section: "The Precision/Recall Trade-off · The ROC Curve", title: "Every threshold at once",
        text: "Each threshold gives one precision and one recall, so sweeping it draws a curve. The ROC curve does the same with recall against false alarms. A better model pushes these curves toward the corner, and the area under the ROC curve sums that up in one number.",
        tryIt: "Slide the threshold and watch the green marker travel along both curves in opposite directions.",
        Visual: load(h3, "Curves"), lab: LAB_CLASSIFIER_METRICS,
      },
      {
        id: "confusion", section: "Multiclass Classification · Error Analysis", title: "Finding where the model gets confused",
        text: "With ten classes the confusion matrix becomes a 10×10 grid. The bright diagonal is everything it got right, which hides the interesting part. Remove the diagonal and the mistakes stand out as pairs the model mixes up.",
        tryIt: "Switch to errors only and hover the biggest red squares. Which pairs of digits get confused in both directions?",
        Visual: load(h3, "Confusion"),
      },
    ],
    quiz: {
      question: "A cancer-screening model should miss as few real cases as possible. Which measure matters most?",
      options: ["Precision", "Recall", "Accuracy", "Training loss"],
      answer: 1,
      why: "Recall is the share of real cases that were caught. You accept more false alarms (lower precision) to avoid missing any.",
    },
  },
  "homl-5": {
    scenes: [
      {
        id: "margin", section: "Linear SVM Classification", title: "The widest street between two groups",
        text: "A support vector machine does not just separate two classes, it looks for the widest possible street between them. Only the points on the edge of the street matter: those are the support vectors. The setting C decides how much it tolerates points on the street.",
        tryIt: "Lower C to 0.01: the street widens and lets points in. Raise it to 100: the street narrows to avoid them.",
        Visual: load(h5, "Margin"), lab: LAB_SVM,
      },
      {
        id: "lift", section: "Nonlinear SVM Classification", title: "When a line is not enough, add a dimension",
        text: "Some data cannot be split by any straight line, like one group surrounding another. Add a new feature computed from the old ones and the picture changes: lifted into 3D, a flat cut separates them. Kernels get this effect without ever building the extra dimensions.",
        tryIt: "Drag the lift to 100%, then rotate to look from the side. The white grid is the flat cut.",
        Visual: load(h5, "KernelLift"),
      },
      {
        id: "gamma", section: "Gaussian RBF Kernel", title: "Gamma: how far each point's influence reaches",
        text: "With the RBF kernel each training point pushes its surroundings toward its own class. Gamma sets the reach. Small gamma gives broad, smooth regions. Large gamma shrinks every point's influence to a small island, which fits the training data perfectly and generalises badly.",
        tryIt: "Start at 0.1 and raise gamma slowly. Find where new-data accuracy peaks, then keep going and watch islands form.",
        Visual: load(h5, "Gamma"), lab: LAB_SVM,
      },
    ],
    quiz: {
      question: "Your RBF SVM scores 100% on training data and 80% on new data. What should you try first?",
      options: ["Increase gamma", "Decrease gamma or C", "Add more features", "Remove the support vectors"],
      answer: 1,
      why: "That gap is overfitting. Lower gamma widens each point's reach and lower C allows a wider margin; both make the boundary smoother.",
    },
  },
  "homl-6": {
    scenes: [
      {
        id: "impurity", section: "Gini Impurity or Entropy", title: "How mixed is a box?",
        text: "A decision tree works by splitting data into boxes that are as pure as possible. Gini impurity measures the mix: 0 when a box holds one class only, highest at an even split. Entropy is a second measure that behaves almost the same way.",
        tryIt: "Drag from 0 to 20 and find where each curve peaks and where it reaches zero.",
        Visual: load(h6, "Impurity"),
      },
      {
        id: "grow", section: "Training and Visualizing a Decision Tree · Regularization", title: "Grow a tree one question at a time",
        text: "At each step the tree asks one yes-or-no question about one feature, choosing the question that leaves the purest boxes. Left alone it keeps going until it has memorised the training set. Limiting depth or leaf size stops it earlier.",
        tryIt: "Raise the depth one step at a time and watch training accuracy pass new-data accuracy. Then set the smallest leaf to 8.",
        Visual: load(h6, "TreeGrow"), lab: LAB_TREE,
      },
      {
        id: "rotate", section: "Sensitivity to Axis Orientation", title: "Trees only cut straight across",
        text: "Every split is a horizontal or vertical cut, never a diagonal one. Data that lines up with the axes needs one split. Turn the very same data by 45° and the tree has to build a staircase to follow the border.",
        tryIt: "Rotate from 0° to 45° and count the splits. Then continue to 90° and see it become simple again.",
        Visual: load(h6, "TreeRotate"),
      },
    ],
    quiz: {
      question: "An unrestricted decision tree gets 100% on training data. What is the usual catch?",
      options: ["It is underfitting", "It has probably memorised noise and will do worse on new data", "It cannot be drawn", "Its Gini impurity is too high"],
      answer: 1,
      why: "A tree with no limits keeps splitting until every leaf is pure, including leaves built around single noisy points.",
    },
  },
  "homl-4": {
    scenes: [
      {
        id: "line", section: "Linear Regression", title: "A model is a line you can move",
        text: "Linear regression predicts with a straight line. Two numbers define it: where it starts (the intercept) and how steep it is (the slope). Training means finding the pair that makes the coloured error bars as short as possible, measured by the mean squared error.",
        tryIt: "Drag both sliders to shrink the error, then press Snap to best to see how close you got.",
        Visual: load(h4, "LineFit"),
      },
      {
        id: "descent", section: "Gradient Descent", title: "Rolling downhill on the error surface",
        text: "Every possible line has an error, so all of them together form a landscape. Gradient descent starts somewhere, measures which way is downhill, and takes a step. The learning rate is the size of that step.",
        tryIt: "Set the learning rate to 0.02 (slow), 0.1 (good), then above 0.46 and watch it overshoot and explode.",
        Visual: load(h4, "DescentSurface"), lab: LAB_GRADIENT_DESCENT,
      },
      {
        id: "paths", section: "Batch, Stochastic and Mini-batch", title: "Three ways to take a step",
        text: "Batch gradient descent looks at every training point before each step: smooth but slow on big data. Stochastic uses one random point: fast but jittery, and it never quite settles. Mini-batch uses a small handful and sits in between, which is why it is the usual choice.",
        tryIt: "Press Race again a few times. The white path never changes; the other two take a different route each time.",
        Visual: load(h4, "DescentPaths"),
      },
      {
        id: "poly", section: "Polynomial Regression and Learning Curves", title: "Too simple, too flexible, just right",
        text: "A curved model can follow curved data, but more flexibility is not always better. Too little and it misses the pattern (underfitting). Too much and it memorises the noise in the training points and fails on new data (overfitting).",
        tryIt: "Raise the degree from 1 to 2, then all the way to 14. Watch training error keep falling while new-data error climbs.",
        Visual: load(h4, "PolyFit"),
      },
      {
        id: "ridge", section: "Regularized Linear Models", title: "Putting a leash on the model",
        text: "Regularization adds a penalty for large weights, so the model has to stay simple unless the data really demands otherwise. Ridge regression is the most common form. The strength α sets how tight the leash is.",
        tryIt: "The model starts wildly overfitted at degree 12. Raise the ridge strength until the verdict turns to Good fit, then keep going until it underfits.",
        Visual: PolyRidge,
      },
      {
        id: "logistic", section: "Logistic Regression", title: "From a line to a yes-or-no answer",
        text: "For classification, the line's output is squeezed through an S-shaped curve so it becomes a probability between 0 and 1. Above 0.5 the model says yes. The weight sets how sharp the switch is; the bias sets where it happens.",
        tryIt: "Try to separate green from red by hand, then press Train it and compare.",
        Visual: load(h4, "Logistic"),
      },
    ],
    quiz: {
      question: "Your model has very low training error but high error on new data. What is happening?",
      options: ["It is underfitting", "It is overfitting", "The learning rate is too low", "It needs more features"],
      answer: 1,
      why: "A gap between training and new-data error means the model memorised its training points. Simplify it, regularize it, or get more data.",
    },
  },
  "homl-7": {
    scenes: [
      {
        id: "voting", section: "Voting Classifiers", title: "Many weak voters make one strong one",
        text: "Combine many models that are each only slightly better than a coin flip, take the majority vote, and the group can be far more accurate than any member. The catch is that this works best when their mistakes are independent.",
        tryIt: "Set each voter to 51% and raise the count. Then try 55% and 60% and see how much faster the crowd improves.",
        Visual: load(h7, "Voting"),
      },
      {
        id: "bagging", section: "Bagging and Pasting · Random Forests", title: "A forest is smoother than a tree",
        text: "Bagging trains many trees, each on a different random resample of the training data, then lets them vote. Each tree overfits in its own way, and the errors partly cancel. A random forest is this idea plus some extra randomness in each split.",
        tryIt: "With one tree the border is jagged. Add trees and watch it smooth out while new-data accuracy rises.",
        Visual: load(h7, "Bagging"), lab: LAB_FOREST,
      },
      {
        id: "boosting", section: "Boosting · Gradient Boosting", title: "Each new tree fixes what is left",
        text: "Boosting builds trees one after another. Each new small tree is trained on the errors the ensemble still makes, and its answer is added in. The learning rate shrinks each contribution: lower means more trees are needed but the result usually generalises better.",
        tryIt: "At rate 0.3 add trees one by one and watch the grey error lines shrink. Then compare 80 trees at rate 1.0 with rate 0.1.",
        Visual: load(h7, "Boosting"), lab: LAB_FOREST,
      },
    ],
    quiz: {
      question: "Why does averaging many overfitted trees usually beat one overfitted tree?",
      options: ["The trees are each more accurate", "Their individual errors differ and partly cancel out", "Averaging removes bias", "It uses less data"],
      answer: 1,
      why: "Each tree sees a different resample and overfits differently. Averaging reduces that variance without making any single tree better.",
    },
  },
  "homl-8": {
    scenes: [
      {
        id: "curse", section: "The Curse of Dimensionality", title: "High-dimensional space is mostly empty",
        text: "Every feature you add is another dimension, and space grows much faster than data does. Points drift far apart, almost all of them end up near an edge, and the number of examples needed to cover the space explodes.",
        tryIt: "Go from 2 to 10 to 100 features. Watch the distance grow and the share of edge points approach 100%.",
        Visual: load(h8, "Curse"),
      },
      {
        id: "pca", section: "PCA · Preserving the Variance, Principal Components", title: "Find the directions that matter",
        text: "Data often spreads mostly along a few directions. PCA finds them in order: the first is where the points vary most, the second is the next most at a right angle, and so on. Dropping the last ones loses little.",
        tryIt: "Rotate until you see the cloud is nearly a flat sheet. Then flatten it to 100% and check how much was kept.",
        Visual: load(h8, "Pca3D"), lab: LAB_PCA,
      },
      {
        id: "roll", section: "Manifold Learning", title: "Some shapes must be unrolled, not squashed",
        text: "A rolled-up sheet is really two-dimensional even though it sits in 3D. Squashing it flat stacks distant parts on top of each other. Manifold methods try to unroll it instead, keeping points that are neighbours along the sheet as neighbours.",
        tryIt: "Squash it flat to 100% and see the colours mix. Then switch to unroll and do the same.",
        Visual: load(h8, "SwissRoll"),
      },
    ],
    quiz: {
      question: "PCA's first principal component is the direction where the data…",
      options: ["Has the smallest spread", "Has the largest spread", "Is closest to the origin", "Has the most missing values"],
      answer: 1,
      why: "PCA ranks directions by variance. Keeping the top few keeps as much of the data's spread as possible.",
    },
  },
  "homl-9": {
    scenes: [
      {
        id: "kmeans", section: "Clustering Algorithms: k-means", title: "K-means, one round at a time",
        text: "K-means starts with k centres placed at random. Each round, every point joins its nearest centre, then each centre moves to the middle of its points. It repeats until nothing changes. A bad starting position can leave it stuck in a poor answer.",
        tryIt: "Press Step a few times and watch the centres move. Then press New random start several times and Run: the final inertia is not always the same.",
        Visual: load(h9, "KMeansSteps"), lab: LAB_CLUSTER,
      },
      {
        id: "elbow", section: "Finding the Optimal Number of Clusters", title: "How many clusters are there really?",
        text: "Inertia always falls as you add clusters, so the lowest value tells you nothing. Look instead for the elbow: the point where adding another cluster stops buying much.",
        tryIt: "Raise k from 1 to 9 and read the gain each time. Where does it collapse?",
        Visual: load(h9, "Elbow"),
      },
      {
        id: "dbscan", section: "DBSCAN", title: "Clusters as crowded regions",
        text: "DBSCAN does not look for centres. It calls a point a core point if enough neighbours sit within its reach, and grows clusters by chaining core points together. It can follow any shape and labels isolated points as noise.",
        tryIt: "See k-means cut the crescents in half, then switch to DBSCAN. Shrink the reach until clusters shatter, and widen it until they merge.",
        Visual: load(h9, "Dbscan"), lab: LAB_CLUSTER,
      },
      {
        id: "mixture", section: "Gaussian Mixtures · Anomaly Detection", title: "A map of where data is expected",
        text: "A Gaussian mixture model describes the data as a blend of a few bell-shaped clouds, each with its own centre, size and tilt. That gives a likelihood for every location, so anything sitting where the model expects almost nothing can be flagged as an anomaly.",
        tryIt: "Raise the slider to 4% and see which points get flagged first. Keep going and notice when it starts flagging ordinary points.",
        Visual: load(h9, "Mixture"),
      },
    ],
    quiz: {
      question: "Your data forms two long curved bands. Which method is the better first choice?",
      options: ["K-means with k = 2", "DBSCAN", "PCA", "Linear regression"],
      answer: 1,
      why: "K-means assumes round, similar-sized blobs. DBSCAN follows dense regions of any shape.",
    },
  },
  "homl-10": {
    scenes: [
      {
        id: "neuron", section: "The Perceptron", title: "One neuron draws one line",
        text: "An artificial neuron multiplies each input by a weight, adds a bias, and fires if the total is above zero. Geometrically that is a straight line: fire on one side, stay off on the other.",
        tryIt: "Solve AND, then OR. Then switch to XOR and try as long as you like: no single line can do it.",
        Visual: load(h10, "Neuron"),
      },
      {
        id: "activation", section: "Activation Functions", title: "Why neurons need a bend",
        text: "The activation function decides how strongly a neuron responds. Training needs a slope to follow, and the step function is flat everywhere, so networks use smooth or piecewise alternatives. ReLU is the usual default for hidden layers.",
        tryIt: "Switch between the four and move z. Notice the step function's slope is always 0: nothing to learn from.",
        Visual: load(h10, "Activations"),
      },
      {
        id: "train", section: "The Multilayer Perceptron and Backpropagation", title: "A hidden layer solves XOR",
        text: "Stack neurons into a hidden layer and their lines combine into shapes. Backpropagation trains them: run the inputs forward, measure the error, send it backward to find how much each weight contributed, and nudge every weight a little.",
        tryIt: "Press Train with 1 hidden neuron: it fails. Set 3 or more and train again. Then try the circle data.",
        Visual: load(h10, "TinyTrainer"), lab: LAB_MLP,
      },
      {
        id: "shape", section: "Building an MLP · Hyperparameters", title: "Depth, width and what they cost",
        text: "Two of the main choices when you build a network are how many hidden layers it has and how many neurons are in each. Every connection is a number to learn, and the count grows fast as layers get wider.",
        tryIt: "Double the width from 8 to 16 and watch the connection count. Then add layers instead and compare.",
        Visual: load(h10, "DepthWidth"), lab: LAB_MLP,
      },
    ],
    quiz: {
      question: "Why can't a single neuron learn XOR?",
      options: ["It has too few weights to store four answers", "It can only split the inputs with one straight line", "XOR needs a sigmoid activation", "The learning rate would have to be negative"],
      answer: 1,
      why: "XOR's two 'on' points sit on opposite corners, so no single straight line separates them. A hidden layer combines several lines into a shape that does.",
    },
  },
  "homl-11": {
    scenes: [
      {
        id: "flow", section: "The Vanishing/Exploding Gradients Problems", title: "Signals die or blow up in deep networks",
        text: "Training sends an error signal backward through every layer. Each layer multiplies it, so over many layers it can shrink to nothing or grow without limit, and the early layers stop learning. The fix is a matched pair: the right activation with the right starting weights.",
        tryIt: "With sigmoid and plain random weights, raise the layers to 30. Then try tanh with Glorot, and relu with He.",
        Visual: load(h11, "GradientFlow"), lab: LAB_DEEP,
      },
      {
        id: "optimizers", section: "Faster Optimizers", title: "Four ways to walk down a narrow valley",
        text: "Plain gradient descent zigzags across steep directions and crawls along gentle ones. Momentum builds up speed like a rolling ball. RMSProp gives each weight its own step size. Adam combines both, which is why it is the common default.",
        tryIt: "Watch the race, then raise the learning rate and see which ones stay stable.",
        Visual: load(h11, "Optimizers"), lab: LAB_DEEP,
      },
      {
        id: "schedules", section: "Learning Rate Scheduling", title: "Start fast, finish carefully",
        text: "A high learning rate makes quick early progress but keeps bouncing around the answer. A low one settles precisely but takes forever. A schedule does both: large steps first, smaller ones later.",
        tryIt: "Compare the loss each schedule settles at. Constant never calms down; the others do.",
        Visual: load(h11, "Schedules"),
      },
      {
        id: "dropout", section: "Avoiding Overfitting Through Regularization · Dropout", title: "Train with random neurons switched off",
        text: "Dropout switches off a random share of neurons at every training step. No neuron can rely on a particular partner being there, so the network learns more robust features. When the model is used for real, every neuron is switched back on.",
        tryIt: "Raise the rate to 80% and watch how little of the network is left each step. Then switch the phase to using the model.",
        Visual: load(h11, "Dropout"), lab: LAB_DEEP,
      },
    ],
    quiz: {
      question: "A 20-layer sigmoid network trains its last layers but the first ones barely change. What is the likely cause?",
      options: ["The learning rate is too high", "Vanishing gradients", "Too much dropout", "Too little data"],
      answer: 1,
      why: "The error signal shrinks at every sigmoid layer on the way back, so almost nothing reaches the early layers. ReLU with He initialization or batch normalization addresses it.",
    },
  },
  "homl-12": {
    scenes: [
      {
        id: "tensors", section: "Using TensorFlow like NumPy · Tensors and Operations", title: "Everything is a tensor",
        text: "A tensor is a grid of numbers with some number of axes. One number is a scalar, a list is a vector, a table is a matrix, and a stack of tables is a 3D tensor. The shape lists the size along each axis, and it is the first thing to check when code breaks.",
        tryIt: "Go from rank 0 to rank 3 and watch the shape grow by one entry each time. Then change the sizes.",
        Visual: load(h12, "TensorShapes"),
      },
      {
        id: "loss", section: "Customizing Models and Training Algorithms · Custom Loss Functions", title: "Writing your own loss",
        text: "The loss function decides what counts as a bad mistake. Squared error punishes big errors very hard, so a few outliers can drag the whole model. The Huber loss acts like squared error for small mistakes and grows only in a straight line for large ones.",
        tryIt: "Lower the threshold to 0.5 and watch the green line ignore the two red outliers. Raise it to 4 and it behaves like squared error again.",
        Visual: load(h12, "CustomLoss"),
      },
      {
        id: "autodiff", section: "Computing Gradients Using Autodiff", title: "Gradients come from replaying the calculation backwards",
        text: "Frameworks record every operation as it happens. To get gradients they walk that record in reverse, applying one simple rule per operation. This is how a model with millions of weights gets all its gradients in a single backward pass.",
        tryIt: "Change the weights on the forward pass, then switch to the backward pass and read the gradient arriving at each box.",
        Visual: load(h12, "Autodiff"), lab: LAB_CUSTOM_LOOP,
      },
      {
        id: "loop", section: "Custom Training Loops", title: "What fit() does on every step",
        text: "Calling fit() hides a loop of five stages repeated thousands of times: take a batch, predict, measure the loss, compute gradients, update the weights. Writing the loop yourself gives full control when the standard one is not enough.",
        tryIt: "Press Next stage five times to complete one step and see each number appear. Then run 10 steps and watch the weights approach 2 and 1.",
        Visual: load(h12, "TrainingLoop"), lab: LAB_CUSTOM_LOOP,
      },
    ],
    quiz: {
      question: "In a training step, what must happen before the weights can be updated?",
      options: ["The data is shuffled again", "The gradients of the loss are computed", "The model is saved", "The learning rate is reset"],
      answer: 1,
      why: "The update moves each weight against its gradient, so the forward pass, the loss and the backward pass all come first.",
    },
  },
  "homl-13": {
    scenes: [
      {
        id: "pipeline", section: "The tf.data API · Chaining Transformations, Shuffling the Data", title: "A data pipeline is a chain of small steps",
        text: "Large datasets do not fit in memory, so they are streamed through a pipeline: shuffle, group into batches, repeat for several epochs. Shuffling a stream uses a buffer: the bigger the buffer, the better the mix.",
        tryIt: "With the buffer off the batches come out in order. Raise it to 4, then to 16, and watch the mixing improve.",
        Visual: load(h13, "Pipeline"),
      },
      {
        id: "prefetch", section: "The tf.data API · Prefetching", title: "Never let the GPU wait for data",
        text: "Without prefetching, the CPU prepares a batch, then the GPU trains on it, then the CPU starts the next one, and each sits idle half the time. Prefetching prepares the next batch while the current one is training.",
        tryIt: "Switch to prefetch and compare the total time. Then make preparing slower than training and see the GPU start waiting again.",
        Visual: load(h13, "Prefetch"),
      },
      {
        id: "categories", section: "Keras Preprocessing Layers · Encoding Categorical Features", title: "Four ways to turn a category into numbers",
        text: "Text categories must become numbers. A lookup assigns each one an ID. One-hot gives each its own column. Hashing skips the list entirely but can collide. An embedding gives each category a few learned numbers, which scales to very large vocabularies.",
        tryIt: "Go through all four. On hashing, lower the bins until cities start sharing a number.",
        Visual: load(h13, "Categories"),
      },
      {
        id: "reshape", section: "Keras Preprocessing Layers · Normalization and Discretization", title: "Fixing a lopsided feature",
        text: "Features like income pile up at low values with a long tail of large ones. Standardizing moves and rescales it but keeps the lopsided shape. Taking the logarithm first pulls the tail in. Bucketing replaces values with the range they fall in.",
        tryIt: "Compare the skew for raw, standardized, and log then standardized. Only one of them fixes the shape.",
        Visual: load(h13, "Reshape"),
      },
    ],
    quiz: {
      question: "Why does a shuffle buffer of size 1 not shuffle anything?",
      options: ["It runs out of memory", "With one item in the buffer there is only one item to pick", "Shuffling needs a GPU", "It shuffles only the labels"],
      answer: 1,
      why: "The buffer hands out a random item from what it holds. Holding one item means the stream comes out in its original order.",
    },
  },
  "homl-14": {
    scenes: [
      {
        id: "conv", section: "Convolutional Layers · Filters", title: "A filter is a small pattern detector",
        text: "A convolutional layer slides a small grid of weights over the image. At each spot it multiplies and adds, giving one number that says how strongly that patch matches the filter's pattern. The result is a feature map: a picture of where the pattern occurs.",
        tryIt: "Slide the vertical-edge filter, then the horizontal one. Each lights up a different part of the same shape.",
        Visual: load(h14, "Convolution"), lab: LAB_CNN,
      },
      {
        id: "stride", section: "Convolutional Layers · Stride and Padding", title: "Stride and padding set the output size",
        text: "Stride is how far the filter jumps each move: bigger strides shrink the output. Padding adds a border of zeros so the filter can reach the edges, which can keep the output the same size as the input.",
        tryIt: "With a 3×3 filter, set padding to 1 and stride to 1 to keep 7×7. Then raise the stride to 2.",
        Visual: load(h14, "StridePadding"),
      },
      {
        id: "pool", section: "Pooling Layers", title: "Pooling shrinks the map and keeps what matters",
        text: "A pooling layer summarises each small block with one number, usually its maximum. That cuts the amount of data by four while keeping the strongest responses and roughly where they were.",
        tryIt: "Compare max with average pooling. Max keeps the strongest signal at full strength; average waters it down.",
        Visual: load(h14, "Pooling"),
      },
      {
        id: "volumes", section: "CNN Architectures", title: "The whole network: wide and shallow to narrow and deep",
        text: "A typical CNN repeats the same move: convolution layers add feature maps, pooling halves the height and width. The data starts as a wide thin sheet and ends as a small deep block, which is then flattened for the final classification layers.",
        tryIt: "Step through the layers and watch the shape. Then switch networks and find which single layer holds most of the weights.",
        Visual: load(h14, "Volumes"), lab: LAB_CNN,
      },
    ],
    quiz: {
      question: "A 3×3 filter with stride 1 and no padding runs over a 7×7 input. How big is the output?",
      options: ["7×7", "5×5", "3×3", "9×9"],
      answer: 1,
      why: "(7 + 0 − 3) ÷ 1 + 1 = 5. Without padding the filter cannot centre on the border pixels, so one row is lost on each side.",
    },
  },
  "homl-15": {
    scenes: [
      {
        id: "unroll", section: "Recurrent Neurons and Layers", title: "A neuron that remembers",
        text: "A recurrent neuron receives two things at every step: the new input and its own output from the step before. That loop is its memory. Drawn step by step, it becomes a chain passing a message along through time.",
        tryIt: "With one pulse, lower the memory weight to 0.3 and watch the pulse fade at once. Raise it above 1 and it never fades.",
        Visual: load(h15, "Unroll"),
      },
      {
        id: "forecast", section: "Forecasting a Time Series", title: "Always beat the naive forecast first",
        text: "Before building anything clever, try the obvious: tomorrow equals today, or equals the same day last season. These baselines are often hard to beat. A learned model earns its place only if it does better.",
        tryIt: "Set 24 months ahead and compare the average miss for all three methods.",
        Visual: load(h15, "Forecast"), lab: LAB_RNN,
      },
      {
        id: "memory", section: "Handling Long Sequences", title: "Why simple RNNs forget",
        text: "Passing a signal through many time steps multiplies it again and again. Slightly under 1 and it vanishes; slightly over and it explodes. LSTM cells add a memory lane guarded by a forget gate that can stay close to 1, so information can survive hundreds of steps.",
        tryIt: "For the simple RNN try 0.9 and then 1.1. Then switch to LSTM and set the forget gate to 1.000.",
        Visual: load(h15, "LongMemory"), lab: LAB_RNN,
      },
      {
        id: "lstm", section: "LSTM Cells", title: "Inside an LSTM cell: three gates",
        text: "An LSTM cell keeps a memory and controls it with three gates, each a dial from 0 to 1. The forget gate decides how much old memory to keep. The input gate decides how much new information to write. The output gate decides how much to reveal.",
        tryIt: "Set forget to 1 and input to 0: the memory passes through untouched. Then set forget to 0 and input to 1: it is overwritten.",
        Visual: load(h15, "LstmCell"),
      },
    ],
    quiz: {
      question: "What does an LSTM's forget gate set to 0 do?",
      options: ["Keeps the old memory unchanged", "Erases the old memory", "Blocks new input", "Hides the output"],
      answer: 1,
      why: "The old memory is multiplied by the forget gate. At 0 nothing of it survives; at 1 all of it does.",
    },
  },
  "homl-16": {
    scenes: [
      {
        id: "tokens", section: "Generating Text Using a Character RNN · Tokenization", title: "Text has to become numbers",
        text: "A model cannot read letters, only numbers, so text is first cut into tokens and each token gets an ID. Cutting by character gives a tiny vocabulary but long sequences. Cutting by word gives short sequences but a vocabulary that grows with every new word.",
        tryIt: "Type your own sentence and switch between characters and words. Watch the two counts trade places.",
        Visual: load(h16, "Tokens"),
      },
      {
        id: "embeddings", section: "Sentiment Analysis · Reusing Pretrained Embeddings", title: "Words as points on a map",
        text: "An embedding gives every token a position in space, learned so that words used in similar ways end up close together. Directions on the map can carry meaning too, which is how arithmetic like king − man + woman can land near queen.",
        tryIt: "Click different words to see their neighbours, then try the three word sums.",
        Visual: load(h16, "Embeddings"),
      },
      {
        id: "beam", section: "An Encoder–Decoder Network for Neural Machine Translation · Beam Search", title: "Do not commit to the first good word",
        text: "Picking the most likely word at every step (greedy decoding) can walk into a dead end. Beam search keeps several partial sentences alive at once and only drops the weakest, so a slow start can still win.",
        tryIt: "At width 1 note the final probability. Raise it to 2 and see a sentence that started in second place come out on top.",
        Visual: load(h16, "BeamSearch"),
      },
      {
        id: "position", section: "Attention Is All You Need: The Transformer Architecture · Positional Encodings", title: "Telling a transformer where each word is",
        text: "A transformer looks at all words at once, so on its own it has no idea of their order. Positional encoding fixes that by adding a unique pattern of waves to each position. Nearby positions get similar patterns, distant ones differ.",
        tryIt: "Put A and B next to each other, then move B far away and watch the similarity fall.",
        Visual: load(h16, "Positional"),
      },
    ],
    quiz: {
      question: "Why does a transformer need positional encodings while an RNN does not?",
      options: ["Transformers have fewer weights", "An RNN reads tokens in order; a transformer sees them all at once", "RNNs cannot use embeddings", "Positional encodings speed up training"],
      answer: 1,
      why: "Order is built into an RNN because it processes one token after another. Attention treats the input as a set, so position has to be added as extra information.",
    },
  },
  "homl-17": {
    scenes: [
      {
        id: "bottleneck", section: "Efficient Data Representations · Undercomplete Autoencoders", title: "Squeeze the data, then rebuild it",
        text: "An autoencoder is trained to copy its input to its output through a narrow middle. Because the middle cannot hold everything, the network has to learn what matters most. Here two numbers are squeezed to one and rebuilt.",
        tryIt: "Turn the direction by hand to shorten the red lines, then press Train it and see where it settles.",
        Visual: load(h17, "Bottleneck"), lab: LAB_AUTOENCODER,
      },
      {
        id: "latent", section: "Variational Autoencoders · Generating Images", title: "Blending in code space, not pixel space",
        text: "The narrow middle of an autoencoder is called the latent space. Mixing two pictures pixel by pixel gives a ghostly overlap. Mixing their codes and decoding the result gives a new picture that still looks like a real one, which is how these models generate.",
        tryIt: "Stop at 50%. On the left you see two shapes overlapping; on the right, one in-between shape.",
        Visual: load(h17, "LatentWalk"),
      },
      {
        id: "gan", section: "Generative Adversarial Networks", title: "A forger and a detective train each other",
        text: "A GAN is two networks in a contest. The generator makes fakes. The discriminator tries to tell fakes from real data. Each improves by beating the other, until the fakes are hard to tell apart. The balance is delicate and training often wobbles.",
        tryIt: "Press Train and watch the green curve chase the white one while the red line tilts to tell them apart.",
        Visual: load(h17, "TinyGan"),
      },
      {
        id: "diffusion", section: "Diffusion Models", title: "Learn to remove noise, one small step at a time",
        text: "A diffusion model is trained on pictures that have had noise added in many small steps until nothing is left. Its job is to undo one step. To generate, it starts from pure noise and removes a little at a time until a picture appears.",
        tryIt: "Add noise to step 50 and watch the shape dissolve. Then choose removing noise and bring it back.",
        Visual: load(h17, "Diffusion"),
      },
    ],
    quiz: {
      question: "What stops an autoencoder from simply copying its input straight through?",
      options: ["A high learning rate", "The narrow bottleneck in the middle", "The loss function", "Dropout"],
      answer: 1,
      why: "The middle layer has fewer numbers than the input, so a perfect copy is impossible and the network must learn a compact summary.",
    },
  },
  "homl-18": {
    scenes: [
      {
        id: "grid", section: "Q-Learning", title: "Learning from reward alone",
        text: "A reinforcement learning agent is never told the right move. It acts, receives rewards, and gradually learns how good each action is in each situation. Those learned scores are Q-values, and the best route is simply following the highest one.",
        tryIt: "Play 1 episode at a time and watch values appear near the goal first, then spread backwards. Then add 50 at once.",
        Visual: load(h18, "GridWorld"),
      },
      {
        id: "discount", section: "Evaluating Actions: The Credit Assignment Problem", title: "How much is a future reward worth now?",
        text: "The discount factor shrinks rewards the further away they are. Close to 1, the agent is patient and plans far ahead. Lower values make it short-sighted, chasing whatever pays soonest.",
        tryIt: "Find the value of γ where the agent's preference flips from the big late reward to the small early one.",
        Visual: load(h18, "Discount"),
      },
      {
        id: "bandit", section: "Exploration Policies", title: "Try something new, or stick with what works?",
        text: "An agent that only repeats its best-known action may never discover a better one. One that explores all the time never cashes in. The usual compromise is to act greedily most of the time and pick at random a small share of the time.",
        tryIt: "Set exploring to 0% and play several times: it often locks onto the wrong machine. Then try 10% and 50%.",
        Visual: load(h18, "Bandit"),
      },
    ],
    quiz: {
      question: "An agent with a discount factor near 0 will mostly…",
      options: ["Plan many steps ahead", "Care only about immediate rewards", "Explore at random", "Stop learning"],
      answer: 1,
      why: "Each step into the future multiplies the reward by the discount factor, so near 0 anything beyond the next step is worth almost nothing.",
    },
  },
  "homl-19": {
    scenes: [
      {
        id: "serving", section: "Serving a TensorFlow Model · Deploying a New Model Version", title: "Rolling out a new model safely",
        text: "A model server sits between apps and the model and can run several versions at once. A new version is given a small share of traffic first. If it misbehaves, traffic goes back to the old one and most users never notice.",
        tryIt: "Send 10% to version 2, then break it and count the failures. Now try the same at 100%.",
        Visual: load(h19, "Serving"),
      },
      {
        id: "quantize", section: "Deploying a Model to a Mobile or Embedded Device", title: "Shrinking a model by rounding its weights",
        text: "Weights are normally stored as 32-bit numbers. Quantization rounds them to a small set of allowed values so each fits in 8 bits or fewer. The model gets several times smaller and faster, at the cost of a small rounding error.",
        tryIt: "Go from 16 bits down to 8, then 4, then 2. Find where the green staircase stops following the grey curve.",
        Visual: load(h19, "Quantize"),
      },
      {
        id: "gpus", section: "Training Models Across Multiple Devices", title: "More GPUs, with diminishing returns",
        text: "With data parallelism every GPU holds a copy of the model and gets a slice of each batch, then the results are combined. The combining is not free, so doubling the GPUs gives less than double the speed.",
        tryIt: "At 10% overhead go from 1 to 8 GPUs and read the efficiency. Then raise the overhead to 30%.",
        Visual: load(h19, "MultiGpu"),
      },
    ],
    quiz: {
      question: "Why send only a small share of traffic to a newly deployed model version?",
      options: ["To save GPU memory", "So a faulty version affects few users and can be rolled back", "Because new versions are slower", "To train it faster"],
      answer: 1,
      why: "A gradual rollout limits the damage of a bad version and gives time to compare it with the current one before switching everyone.",
    },
  },
  "aie-1": {
    scenes: [
      {
        id: "self", section: "From Language Models to Large Language Models · Self-supervision", title: "Text that labels itself",
        text: "Older machine learning needed people to label every example. A language model learns by hiding the next word and trying to guess it, so any text is already a set of exercises with answers. That removed the labelling bottleneck and let models grow.",
        tryIt: "Slide through the sentence. Every position is one training example, and nobody had to write an answer key.",
        Visual: load(aA, "SelfSupervision"),
      },
      {
        id: "stack", section: "The AI Engineering Stack · Three Layers of the AI Stack", title: "Three layers, and where the work moved",
        text: "Building with AI splits into three layers. With strong ready-made models available, most new effort has shifted to the top layer: shaping what goes into the model and checking what comes out, without training anything.",
        tryIt: "Open each layer and compare who works there and what they do.",
        Visual: load(aA, "Stack"),
      },
      {
        id: "ladder", section: "AI Engineering Versus ML Engineering · Model Adaptation", title: "Change as little as you can",
        text: "There are several ways to make a model do what you need, and they differ enormously in cost. Start with the cheapest and only climb when it is not enough: instructions first, then extra context, then finetuning.",
        tryIt: "Step up the ladder one rung at a time and read when each one is the right tool.",
        Visual: load(aA, "AdaptLadder"),
      },
    ],
    quiz: {
      question: "Why could language models be trained on far more data than earlier models?",
      options: ["Computers became cheaper", "Text provides its own labels, so no manual labelling is needed", "They use smaller vocabularies", "They skip the training step"],
      answer: 1,
      why: "Predicting the next word turns any piece of text into training examples automatically. That is self-supervision.",
    },
  },
  "aie-2": {
    scenes: [
      {
        id: "next", section: "Modeling", title: "A language model predicts the next token",
        text: "Under everything a language model does is one move: given the text so far, give every possible next token a probability. Text is generated by picking one, adding it, and repeating.",
        tryIt: "Click a word to add it, or let the model pick. Build a sentence one token at a time.",
        Visual: load(a2, "NextToken"),
      },
      {
        id: "attention", section: "Model Architecture", title: "Attention: which words matter for this one",
        text: "The transformer architecture lets every token look at every other token and decide how much each one matters. That is how a model can work out what a word like “it” refers to, even when the answer is far away in the sentence.",
        tryIt: "Select “it”, then switch the ending between tired and wide. The word “it” points at a different noun.",
        Visual: load(a2, "Attention"),
      },
      {
        id: "size", section: "Model Size", title: "Parameters turn into gigabytes",
        text: "A model's size is counted in parameters, and each one is a number that takes memory. Memory is roughly parameters times bits per parameter. Storing each number with fewer bits (quantization) shrinks the model at some cost in quality.",
        tryIt: "Set 7 billion parameters at 16-bit. It does not fit your GPU. Drop to 4-bit and check again.",
        Visual: load(a2, "ModelMemory"),
      },
      {
        id: "temperature", section: "Sampling Fundamentals", title: "Temperature: predictable or adventurous",
        text: "The model does not always take its top choice; it samples. Temperature reshapes the probabilities first. Low temperature sharpens them so the favourite nearly always wins. High temperature flattens them so unlikely tokens get a real chance.",
        tryIt: "Sample at 0.1, 1.0 and 2.5. Count how many different words appear each time.",
        Visual: load(a2, "Sampler"), lab: LAB_SAMPLING,
      },
      {
        id: "topk", section: "Sampling Strategies", title: "Top-k and top-p: cutting off the tail",
        text: "High temperature is creative but can pick nonsense. Top-k keeps only the k most likely tokens. Top-p keeps the smallest group whose probabilities add up to p. Either way the rest are removed and the survivors are rescaled.",
        tryIt: "Turn temperature up to 2, sample, and spot the odd words. Then set top-k to 4 or top-p to 0.7 and sample again.",
        Visual: SamplerFull, lab: LAB_SAMPLING,
      },
    ],
    quiz: {
      question: "You want the same prompt to give nearly the same answer every time. Which setting helps most?",
      options: ["Raise the temperature", "Lower the temperature towards 0", "Raise top-p to 1", "Use a bigger model"],
      answer: 1,
      why: "Low temperature concentrates probability on the most likely token, so sampling becomes close to always picking the favourite.",
    },
  },
  "aie-3": {
    scenes: [
      {
        id: "perplexity", section: "Understanding Language Modeling Metrics · Entropy, Perplexity", title: "Measuring how unsure a model is",
        text: "Entropy measures the uncertainty in a prediction, in bits. Perplexity is the same thing in friendlier units: the number of equally likely options the model seems to be hesitating between. Lower means the model predicts the text better.",
        tryIt: "Move from clueless to very sure and watch perplexity fall from 8 toward 1.",
        Visual: load(aA, "Perplexity"), lab: LAB_PERPLEXITY,
      },
      {
        id: "similarity", section: "Exact Evaluation · Similarity Measurements Against Reference Data", title: "Is this answer the same as the right one?",
        text: "Comparing an answer with a reference sounds simple and is not. Exact match fails on any rewording. Counting shared words is fooled by a single “not”. Comparing meaning is better, but needs another model to judge.",
        tryIt: "Compare the paraphrase with the wrong-meaning answer. Word overlap ranks them the wrong way round.",
        Visual: load(aA, "Similarity"),
      },
      {
        id: "elo", section: "Ranking Models with Comparative Evaluation", title: "Ranking models by head-to-head comparisons",
        text: "Instead of scoring each answer, show two models' answers side by side and ask which is better. From many such comparisons a rating system works out a ranking, the way chess ratings do. It needs a lot of comparisons before the order is trustworthy.",
        tryIt: "Add one comparison at a time and watch the order jump around. Then add 25 at a time until it settles.",
        Visual: load(aA, "Elo"),
      },
    ],
    quiz: {
      question: "A model's perplexity on some text is 1. What does that mean?",
      options: ["It is guessing at random", "It predicts every next token with certainty", "It has seen one example", "Its vocabulary has one word"],
      answer: 1,
      why: "Perplexity is the number of equally likely choices the model is torn between. One choice means no uncertainty at all.",
    },
  },
  "aie-4": {
    scenes: [
      {
        id: "tradeoff", section: "Evaluation Criteria · Cost and Latency · Model Selection", title: "The best model is the cheapest one that is good enough",
        text: "Choosing a model is a filtering job. Set the quality you must have, the price you can pay and the wait you can accept. Among whatever survives, there is rarely a reason to pay for more than you need.",
        tryIt: "Raise the quality bar to 88 and watch options vanish. Then tighten the time limit to 2 seconds.",
        Visual: load(aA, "TradeOff"),
      },
      {
        id: "buildbuy", section: "Model Build Versus Buy", title: "Pay per use, or run it yourself?",
        text: "An API charges for every token and costs nothing when idle. Hosting a model yourself costs a fixed amount whether you use it or not. Low usage favours the API; above a break-even volume your own servers become cheaper, before counting the engineers to run them.",
        tryIt: "Slide your usage up until the cheaper option flips. Then lower the API price and see the break-even move.",
        Visual: load(aA, "BuildBuy"),
      },
      {
        id: "latency", section: "Evaluation Criteria · Cost and Latency", title: "Two kinds of slow",
        text: "Response time has two parts. Time to first token is the silence before anything appears. After that, tokens per second sets how fast the rest streams out. A chat app cares most about the first; a batch job cares about the total.",
        tryIt: "Keep the total near 10 seconds but trade waiting for streaming. Which version would feel faster to you?",
        Visual: load(aA, "Latency"),
      },
    ],
    quiz: {
      question: "For a chat interface, which latency number matters most to how fast it feels?",
      options: ["Total tokens generated", "Time to first token", "Model size", "Cost per token"],
      answer: 1,
      why: "People judge responsiveness by how soon the answer starts appearing, even if the full answer takes longer.",
    },
  },
  "aie-5": {
    scenes: [
      {
        id: "parts", section: "Introduction to Prompting · In-Context Learning, System Prompt and User Prompt", title: "What a prompt is made of",
        text: "A prompt is assembled from parts: standing instructions, optional background, a few worked examples, and the actual question. Giving no examples is called zero-shot; giving a few is few-shot. Examples often teach the task better than description, at the cost of a longer prompt.",
        tryIt: "Build the prompt up piece by piece and watch the token count grow.",
        Visual: load(aB, "PromptParts"),
      },
      {
        id: "window", section: "Context Length and Context Efficiency", title: "The context window fills up",
        text: "Everything the model can consider must fit in a fixed number of tokens: instructions, the conversation so far, any documents, and room for the reply. When it is full, something has to be left out, and the model has no memory of what was dropped.",
        tryIt: "With the 8,000 window, add turns until old ones start being forgotten. Then switch to a larger window.",
        Visual: load(aB, "ContextWindow"),
      },
      {
        id: "injection", section: "Defensive Prompt Engineering · Jailbreaking and Prompt Injection", title: "When the data starts giving orders",
        text: "A model cannot reliably tell your instructions from text it was merely asked to read. If a web page or document contains instructions, the model may follow them. No single defence is enough, so they are layered.",
        tryIt: "Turn the defences on one at a time and watch the result change.",
        Visual: load(aB, "Injection"),
      },
    ],
    quiz: {
      question: "What makes prompt injection possible?",
      options: ["Models have too few parameters", "Instructions and untrusted content arrive as the same kind of text", "The context window is too small", "Temperature is set too high"],
      answer: 1,
      why: "The model reads one stream of text and has no built-in boundary between what the developer asked and what a document says.",
    },
  },
  "aie-6": {
    scenes: [
      {
        id: "retrieval", section: "RAG · RAG Architecture, Retrieval Algorithms", title: "Find the right pages before answering",
        text: "Retrieval-augmented generation looks up relevant documents first and puts them in the prompt, so the model answers from them instead of from memory. The retriever scores every document against the question and passes on the top few.",
        tryIt: "Type your own question about refunds, opening hours or shipping and watch the ranking change. Then raise k.",
        Visual: load(aB, "Retrieval"), lab: LAB_RETRIEVAL,
      },
      {
        id: "chunks", section: "RAG · Retrieval Optimization · Chunking Strategy", title: "How you cut the text matters",
        text: "Documents are split into chunks before they are indexed. Large chunks blur several topics together. Small chunks lose context. Overlap keeps sentences at the edges intact, at the price of storing some text twice.",
        tryIt: "Shrink the chunk size to 6 and read how little each chunk says. Then add overlap.",
        Visual: load(aB, "Chunking"),
      },
      {
        id: "agent", section: "Agents · Tools, Planning, Agent Failure Modes", title: "An agent thinks, acts, and checks the result",
        text: "An agent is a model that can use tools and decide its own next step. It loops: plan, call a tool, read what came back, and continue until done. Each step can go wrong, and mistakes carry forward, so longer tasks fail more often.",
        tryIt: "Step through the working run. Then choose the run that skips a step and spot where it went wrong.",
        Visual: load(aB, "AgentLoop"),
      },
    ],
    quiz: {
      question: "What is the main reason to add retrieval (RAG) to a model?",
      options: ["To make it respond faster", "To give it information it was not trained on", "To reduce its size", "To change its writing style"],
      answer: 1,
      why: "Retrieval supplies facts at question time: private documents, recent events, anything outside the training data.",
    },
  },
  "aie-7": {
    scenes: [
      {
        id: "choice", section: "When to Finetune · Finetuning and RAG", title: "Retrieval or finetuning?",
        text: "The two fix different problems. If the model fails because it lacks information, give it that information with retrieval. If it has the information but responds in the wrong way, finetuning changes its behaviour. Many systems need both, in that order.",
        tryIt: "Answer the two questions in different combinations and read the recommendation.",
        Visual: load(aB, "RagOrFinetune"),
      },
      {
        id: "memory", section: "Memory Bottlenecks · Memory Math", title: "Training needs far more memory than running",
        text: "Running a model only needs its weights in memory. Training also needs a gradient for every trainable weight and extra numbers for the optimizer, which multiplies the requirement several times. This is the main obstacle to finetuning large models.",
        tryIt: "Pick a size that just fits your GPU for running. Switch to full finetuning, then to LoRA.",
        Visual: load(aB, "TrainMemory"),
      },
      {
        id: "lora", section: "Finetuning Techniques · Parameter-Efficient Finetuning", title: "LoRA: train two thin matrices instead of one big one",
        text: "LoRA freezes the original weights and learns a small correction, written as the product of two narrow matrices. The rank sets how narrow. A fraction of a percent of the parameters is often enough to adapt the model.",
        tryIt: "With a 4,096-wide matrix, compare rank 4 with rank 64. Either way it is a tiny share of the full matrix.",
        Visual: load(aB, "Lora"), lab: LAB_LORA,
      },
    ],
    quiz: {
      question: "A model keeps citing your company's old pricing. What should you try first?",
      options: ["Full finetuning", "Retrieval, so it reads the current prices", "A larger model", "A higher temperature"],
      answer: 1,
      why: "This is missing information, not wrong behaviour. Retrieval gives it the current facts and stays up to date when prices change.",
    },
  },
  "aie-8": {
    scenes: [
      {
        id: "quantity", section: "Data Curation · Data Quality, Data Quantity", title: "More data helps less each time, and bad labels waste it",
        text: "Doubling your data gives a big jump at first and almost nothing later. Wrong labels make every example worth less: you need several times more data to reach the same accuracy, and a gap can remain. A small clean dataset often beats a larger messy one.",
        tryIt: "Read the gain from each doubling with clean labels. Then mislabel 60% of one class: how many examples does it now take to match what 16 clean ones achieved?",
        Visual: load(aC, "Quantity"),
      },
      {
        id: "dedupe", section: "Data Processing · Deduplicate Data", title: "Removing near-duplicates",
        text: "Repeated examples make a dataset look bigger than it is and push the model toward whatever is repeated. Exact copies are easy to find. Near-copies need a similarity threshold, and setting it too low deletes examples that only look alike.",
        tryIt: "Lower the threshold slowly. Find the point where it starts merging questions that are actually different.",
        Visual: load(aC, "Dedupe"),
      },
      {
        id: "format", section: "Data Processing · Format Data", title: "Getting data into the shape a model expects",
        text: "Training code expects examples in a strict structure. For chat models that is a list of turns, each tagged with who is speaking. Using a different format from the one the model was trained with quietly hurts results.",
        tryIt: "Switch between the three formats and see what a program could reliably pull out of each.",
        Visual: load(aC, "Format"),
      },
    ],
    quiz: {
      question: "You have 500 carefully checked examples or 5,000 scraped ones with many wrong labels. Which is usually the safer start?",
      options: ["The 5,000, because more is always better", "The 500, because wrong labels undo much of the benefit of extra data", "Neither works", "Mix them at random"],
      answer: 1,
      why: "Wrong labels make each example worth much less, so a large noisy set can lose to a small clean one. Start clean, then grow carefully.",
    },
  },
  "aie-9": {
    scenes: [
      {
        id: "batching", section: "Inference Service Optimization · Batching", title: "Batching: more throughput, longer waits",
        text: "Processing several requests together uses the hardware better, so the server handles more per second. But each request now waits for its batch to fill. Throughput and latency pull in opposite directions, and the right batch size depends on how busy you are.",
        tryIt: "At 20 requests per second, batch size 1 cannot keep up. Raise it until it can, and watch what happens to the wait.",
        Visual: load(aC, "Batching"),
      },
      {
        id: "pruning", section: "Model Optimization · Model Compression", title: "Pruning: delete the weights that barely matter",
        text: "Many weights in a trained network are close to zero and contribute little. Pruning removes the smallest ones. A large share can often go with limited damage, though in practice the speed-up depends on hardware that can exploit the gaps.",
        tryIt: "Remove 50% of the weights and check how much of the total strength remains. Then try 90%.",
        Visual: load(aC, "Pruning"),
      },
      {
        id: "distill", section: "Model Optimization · Model Distillation", title: "Distillation: a small model learns from a big one",
        text: "A small student model is trained to copy a large teacher's full output, not only the right answer. The teacher's output shows which wrong answers were close, which carries far more information than a single label.",
        tryIt: "Raise the temperature and watch the teacher's opinion of the near-misses become visible.",
        Visual: load(aC, "Distill"),
      },
    ],
    quiz: {
      question: "You increase the batch size on an inference server. What usually happens?",
      options: ["Throughput and latency both improve", "Throughput rises and individual requests wait longer", "Both get worse", "Nothing changes"],
      answer: 1,
      why: "The hardware does more work per pass, but a request may sit waiting for its batch to fill before it starts.",
    },
  },
  "aie-10": {
    scenes: [
      {
        id: "architecture", section: "AI Engineering Architecture · Steps 1 to 5", title: "A real system grows one piece at a time",
        text: "Applications start as a single call to a model. Each later addition solves a specific problem and brings its own cost: context for missing facts, guardrails for safety, a router for cost, a cache for speed, and agent loops for complex tasks.",
        tryIt: "Add the pieces one by one. For each, read what it fixes and what it costs before adding the next.",
        Visual: load(aC, "Architecture"),
      },
      {
        id: "cache", section: "Step 4. Reduce Latency with Caches", title: "Caching: fast and free, until it is wrong",
        text: "A cache returns a stored answer instead of calling the model. Exact-match caching is safe but only helps with identical questions. Matching by similar meaning catches rewordings too, and will occasionally return an answer to a different question.",
        tryIt: "Switch to similar meaning and lower the threshold. Count the calls saved, then count the wrong answers.",
        Visual: load(aC, "Cache"),
      },
      {
        id: "feedback", section: "User Feedback · Extracting Conversational Feedback", title: "Reading feedback from what users do",
        text: "Very few people press a thumbs-up button. But every conversation carries signals: whether they copied the answer, asked again, cut it off, or edited it. Collecting these is how an application learns where it fails.",
        tryIt: "Guess whether each action is a good or bad sign before you click it.",
        Visual: load(aC, "Feedback"),
      },
    ],
    quiz: {
      question: "What is the main risk of a cache that matches questions by similar meaning?",
      options: ["It uses too much memory", "It may return an answer to a different question", "It cannot store long answers", "It slows down the model"],
      answer: 1,
      why: "Two questions can look alike and need different answers. A loose similarity threshold will reuse the wrong one.",
    },
  },
};

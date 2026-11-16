export type Example = { id: string; name: string; code: string };

export const EXAMPLES: Example[] = [
  {
    id: "mlp",
    name: "Neural network · digits",
    code: `# A small neural network that learns to read handwritten digits.
# Add, remove or resize a Dense layer and watch the 3D view change.
import keras
from keras import layers
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split

X, y = load_digits(return_X_y=True)          # 1,797 images, 8x8 pixels each
X = X / 16.0                                 # scale pixels to 0..1
X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)

model = keras.Sequential([
    layers.Input(shape=(64,)),
    layers.Dense(32, activation="relu"),
    layers.Dense(16, activation="relu"),
    layers.Dense(10, activation="softmax"),
])

model.compile(optimizer="adam",
              loss="sparse_categorical_crossentropy",
              metrics=["accuracy"])

model.fit(X_train, y_train, epochs=30, batch_size=32,
          validation_data=(X_test, y_test))

loss, acc = model.evaluate(X_test, y_test, verbose=0)
print(f"test accuracy: {acc:.3f}")
`,
  },
  {
    id: "sklearn",
    name: "Classic ML · decision boundary",
    code: `# A classic model drawn with matplotlib. Any plot you make shows up in Output.
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import make_moons
from sklearn.svm import SVC

X, y = make_moons(n_samples=300, noise=0.25, random_state=0)
clf = SVC(kernel="rbf", gamma=2, C=1).fit(X, y)
print("training accuracy:", clf.score(X, y))

xx, yy = np.meshgrid(np.linspace(-2, 3, 200), np.linspace(-1.5, 2, 200))
zz = clf.decision_function(np.c_[xx.ravel(), yy.ravel()]).reshape(xx.shape)

plt.contourf(xx, yy, zz, levels=20, cmap="gray")
plt.contour(xx, yy, zz, levels=[0], colors="white")
plt.scatter(X[:, 0], X[:, 1], c=y, cmap="cool", s=14, edgecolors="none")
plt.title("SVM decision boundary")
plt.show()
`,
  },
  {
    id: "pandas",
    name: "Data · first look with pandas",
    code: `# Tables are shown in Output. The last line of a run is displayed automatically.
import pandas as pd
from sklearn.datasets import load_iris

df = load_iris(as_frame=True).frame
print(df.shape)
df.describe().round(2)
`,
  },
  {
    id: "torch",
    name: "PyTorch · manual training loop",
    code: `# PyTorch has no fit(), so you report numbers yourself with mle.log().
import torch
from torch import nn
import mle

torch.manual_seed(0)
X = torch.rand(512, 2) * 2 - 1
y = ((X[:, 0] * X[:, 1]) > 0).float().unsqueeze(1)   # XOR-like pattern

net = nn.Sequential(
    nn.Linear(2, 16), nn.Tanh(),
    nn.Linear(16, 8), nn.Tanh(),
    nn.Linear(8, 1),
)
mle.watch(net)                       # show it in 3D

opt = torch.optim.Adam(net.parameters(), lr=0.02)
loss_fn = nn.BCEWithLogitsLoss()

for step in range(300):
    opt.zero_grad()
    out = net(X)
    loss = loss_fn(out, y)
    loss.backward()
    opt.step()
    if step % 5 == 0:
        acc = ((out > 0).float() == y).float().mean()
        mle.log(step=step, loss=loss.item(), acc=acc.item())

print(f"final loss {loss.item():.4f}")
`,
  },
];

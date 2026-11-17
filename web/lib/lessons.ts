/**
 * Guided Lab lessons. Each step says what to write and why, offers hints one at a time,
 * and has a Python check that runs next to the learner's variables after their code runs.
 *
 * Check bodies run in the kernel with these helpers (see server/mle/tasks.py):
 *   need("X")              the variable, or a friendly "create it first" failure
 *   wrote("fit(", ...)     True if the code contains every fragment (spaces ignored)
 *   instances("SVC", fitted=True)   variables of that type
 *   dense(model)           the model's Dense layers
 *   praise = "..."         message shown when the step passes
 * A failing `assert cond, "message"` shows the message.
 */

export type Step = {
  title: string;
  task: string;     // what to write (inline `code` allowed)
  why: string;      // the idea behind it
  hints: string[];  // revealed one at a time; the last one may show the line
  check: string;    // Python
};

export type Lesson = {
  id: string;
  title: string;
  summary: string;
  starter: string;
  steps: Step[];
};

/** Strip the shared indentation so checks can be written indented below. */
function py(source: TemplateStringsArray): string {
  const lines = source.raw[0].replace(/^\n/, "").replace(/\s+$/, "").split("\n");
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent)).join("\n");
}

const network: Lesson = {
  id: "first-network",
  title: "1 · Your first neural network",
  summary: "Teach a small network to read handwritten digits, one piece at a time.",
  starter: `# Lesson 1 · Your first neural network
# Follow the steps in the task card. Write each step's code under its heading,
# then press "Run & check". The imports are done for you.
import keras
from keras import layers
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split

# Step 1 · Load the data


# Step 2 · Scale the pixels


# Step 3 · Split into training and test sets


# Steps 4 and 5 · Build the model


# Step 6 · Compile


# Step 7 · Train


# Step 8 · Evaluate

`,
  steps: [
    {
      title: "Load the data",
      task: "Load the digits dataset into two variables: `X` for the pictures and `y` for the answers. Then print `X.shape`.",
      why: "Every model starts with data. `X` is a table: one row per picture, one column per pixel. `y` holds the digit (0 to 9) each picture shows. The shape tells you how big the problem is.",
      hints: [
        "`load_digits` can hand back the pictures and the answers separately if you pass `return_X_y=True`.",
        "Python can catch two results at once: `first, second = some_function()`.",
        "Write: `X, y = load_digits(return_X_y=True)` and then `print(X.shape)`.",
      ],
      check: py`
        X = need("X"); y = need("y")
        assert getattr(X, "shape", None) == (1797, 64), f"X should be 1,797 rows of 64 pixels, but its shape is {getattr(X, 'shape', None)}."
        assert len(y) == 1797, "y should hold one answer for each of the 1,797 pictures."
        assert wrote("print(") and "shape" in code, "Nearly there: also print X.shape so you can see the size yourself."
        praise = "1,797 pictures, each 8×8 = 64 pixel numbers. y says which digit each one is."
      `,
    },
    {
      title: "Scale the pixels",
      task: "The pixel values go from 0 to 16. Rescale `X` so they go from 0 to 1.",
      why: "Networks learn faster and more steadily when inputs are small numbers of similar size. Big raw values make the first updates jump around.",
      hints: [
        "If the biggest value is 16, what can you divide by so the biggest becomes 1?",
        "You can divide a whole NumPy array at once: `X / 2` halves every value.",
        "Write: `X = X / 16.0`",
      ],
      check: py`
        X = need("X")
        top = float(X.max())
        assert top <= 1.0, f"The largest value in X is still {top:g}. Divide X by 16, the biggest pixel value."
        assert top > 0.5, f"The largest value in X is now {top:g}, which is too small. Did you divide more than once? Divide by 16 a single time."
        praise = "Every pixel is now between 0 and 1."
      `,
    },
    {
      title: "Split into training and test sets",
      task: "Split `X` and `y` into `X_train`, `X_test`, `y_train`, `y_test`. Keep about a quarter for testing and use `random_state=42`.",
      why: "The test set is a sealed exam. The model never sees it while learning, so its score there tells you if it really learned digits or just memorised the training pictures.",
      hints: [
        "`train_test_split` takes `X` and `y` and returns four pieces, in the order: train X, test X, train y, test y.",
        "Its default already keeps 25% for testing. `random_state` makes the shuffle the same every run.",
        "Write: `X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)`",
      ],
      check: py`
        X_train = need("X_train"); X_test = need("X_test"); y_train = need("y_train"); y_test = need("y_test")
        assert len(X_train) + len(X_test) == 1797, "Training and test sets together should hold all 1,797 pictures."
        assert len(X_train) == len(y_train) and len(X_test) == len(y_test), "Each X needs the same number of rows as its y. Check the order: X_train, X_test, y_train, y_test."
        assert 200 <= len(X_test) <= 600, f"The test set has {len(X_test)} pictures. Keep roughly a quarter (about 450) for testing."
        assert float(X_train.max()) <= 1.0, "X_train still has values above 1. Split after scaling, not before."
        praise = f"{len(X_train)} pictures to learn from, {len(X_test)} kept back for the exam."
      `,
    },
    {
      title: "Build the model: input and hidden layer",
      task: "Create `model` as a `keras.Sequential` list of layers: an `Input` that takes 64 numbers, then a `Dense` layer of 32 units with the `relu` activation. Watch the 3D view as you type.",
      why: "A Dense layer connects every input to every unit; each connection has a weight the network will learn. ReLU passes positive signals through and blocks negative ones, which lets stacked layers learn curved patterns instead of only straight lines.",
      hints: [
        "`keras.Sequential([...])` takes a list. Layers run in the order you list them.",
        "The input layer is `layers.Input(shape=(64,))`. The comma makes `(64,)` a one-item tuple.",
        "Write:\n```python\nmodel = keras.Sequential([\n    layers.Input(shape=(64,)),\n    layers.Dense(32, activation=\"relu\"),\n])\n```",
      ],
      check: py`
        model = need("model")
        assert hasattr(model, "layers"), "model should be a keras.Sequential model."
        assert model.input_shape[-1] == 64, f"The model's input takes {model.input_shape[-1]} numbers, but each picture has 64 pixels."
        hidden = [l for l in dense(model) if getattr(l.activation, "__name__", "") == "relu"]
        assert hidden, "Add a Dense layer with activation=\"relu\"."
        praise = f"A hidden layer of {hidden[0].units} ReLU units: {hidden[0].count_params():,} weights to learn."
      `,
    },
    {
      title: "Build the model: output layer",
      task: "Add a last `Dense` layer with 10 units and the `softmax` activation, one unit per digit.",
      why: "The network must give one score per possible answer. Softmax turns the 10 scores into probabilities that add up to 1, so the biggest one is the model's guess.",
      hints: [
        "It goes at the end of the list inside `keras.Sequential([...])`, after the hidden layer.",
        "How many different digits are there? That is the number of units.",
        "Add this line as the last item: `layers.Dense(10, activation=\"softmax\"),`",
      ],
      check: py`
        model = need("model")
        last = model.layers[-1]
        assert type(last).__name__ == "Dense", "The last layer should be a Dense layer."
        assert last.units == 10, f"The last layer has {last.units} units. It needs one per digit: 10."
        assert getattr(last.activation, "__name__", "") == "softmax", "Give the last layer activation=\"softmax\" so its outputs are probabilities."
        praise = f"Complete network: {model.count_params():,} weights in total."
      `,
    },
    {
      title: "Compile",
      task: "Call `model.compile` with the `adam` optimizer, the `sparse_categorical_crossentropy` loss and the `accuracy` metric.",
      why: "The loss measures how wrong the guesses are. The optimizer decides how to nudge every weight to make the loss smaller. Metrics are numbers you watch; they do not drive learning. \"Sparse\" means the answers are plain digits like 7, not lists of ten 0/1 values.",
      hints: [
        "`compile` takes three keyword arguments: `optimizer=`, `loss=` and `metrics=`.",
        "`metrics` takes a list, even for one metric: `[\"accuracy\"]`.",
        "Write: `model.compile(optimizer=\"adam\", loss=\"sparse_categorical_crossentropy\", metrics=[\"accuracy\"])`",
      ],
      check: py`
        model = need("model")
        assert getattr(model, "optimizer", None) is not None and wrote("model.compile("), "Call model.compile(...) after building the model."
        assert "sparse_categorical_crossentropy" in str(model.loss), f"The loss is {model.loss!r}. Use \"sparse_categorical_crossentropy\" because y holds plain digits."
        assert "accuracy" in code, "Add metrics=[\"accuracy\"] so you can watch the share of right answers."
        praise = "Ready to learn: Adam will adjust the weights to shrink the crossentropy loss."
      `,
    },
    {
      title: "Train",
      task: "Train with `model.fit` on the training set for about 20 epochs. Pass the test set as `validation_data` so you can watch both. Look at the Training chart while it runs.",
      why: "One epoch is one pass over all training pictures. After each small batch the optimizer updates the weights. If the training loss keeps falling but the validation loss starts rising, the model is memorising instead of learning.",
      hints: [
        "`fit` takes the training inputs and answers first: `model.fit(X_train, y_train, ...)`.",
        "Add `epochs=20` and `validation_data=(X_test, y_test)`.",
        "Write: `model.fit(X_train, y_train, epochs=20, validation_data=(X_test, y_test))`",
      ],
      check: py`
        model = need("model")
        history = getattr(getattr(model, "history", None), "history", None) or {}
        losses = history.get("loss", [])
        assert losses, "The model has not been trained yet. Call model.fit(X_train, y_train, ...)."
        assert len(losses) >= 5, f"It trained for only {len(losses)} epochs. Use around 20."
        assert "val_loss" in history, "Pass validation_data=(X_test, y_test) so you can compare training and test loss."
        praise = f"Loss fell from {losses[0]:.2f} to {losses[-1]:.2f} over {len(losses)} epochs."
      `,
    },
    {
      title: "Evaluate",
      task: "Use `model.evaluate` on the test set and print the accuracy.",
      why: "This is the exam score: accuracy on pictures the model never trained on. It is the number you would report.",
      hints: [
        "`evaluate` returns the loss and then each metric, so you can catch two values: `loss, acc = ...`.",
        "Pass `verbose=0` to hide the progress bar, then print with `print(f\"test accuracy: {acc:.3f}\")`.",
        "Write: `loss, acc = model.evaluate(X_test, y_test, verbose=0)` and `print(f\"test accuracy: {acc:.3f}\")`",
      ],
      check: py`
        model = need("model"); X_test = need("X_test"); y_test = need("y_test")
        assert wrote("evaluate("), "Call model.evaluate(X_test, y_test) to score the model on the test set."
        guesses = model.predict(X_test, verbose=0).argmax(axis=1)
        score = float((guesses == y_test).mean())
        assert score > 0.85, f"Test accuracy is {score:.0%}. Try more epochs or a bigger hidden layer, then check again."
        praise = f"{score:.1%} of digits it had never seen were read correctly. You built and trained a neural network."
      `,
    },
  ],
};

const boundary: Lesson = {
  id: "decision-boundary",
  title: "2 · Straight lines vs curves",
  summary: "Compare a straight-line model with a curved one, then overfit on purpose.",
  starter: `# Lesson 2 · Straight lines vs curves
# Follow the steps in the task card, then press "Run & check".
import matplotlib.pyplot as plt
from sklearn.datasets import make_moons
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split

# Step 1 · Make the data


# Step 2 · Look at it


# Step 3 · A straight-line model


# Step 4 · A curved model


# Step 5 · An honest score


# Step 6 · Overfit on purpose

`,
  steps: [
    {
      title: "Make the data",
      task: "Create 300 points shaped like two interlocking moons: `X, y = make_moons(...)` with `n_samples=300`, `noise=0.25` and `random_state=0`.",
      why: "Each point has two numbers (an x and a y position) and a class, 0 or 1. The two classes curl around each other, so no straight line can separate them perfectly.",
      hints: [
        "`make_moons` returns the points and their classes, like `load_digits(return_X_y=True)` did.",
        "Pass the three settings as keyword arguments.",
        "Write: `X, y = make_moons(n_samples=300, noise=0.25, random_state=0)`",
      ],
      check: py`
        X = need("X"); y = need("y")
        assert getattr(X, "shape", None) == (300, 2), f"X should be 300 points with 2 numbers each, but its shape is {getattr(X, 'shape', None)}."
        assert set(map(int, y)) == {0, 1}, "y should hold the classes 0 and 1."
        praise = "300 points, 2 coordinates each, in 2 classes."
      `,
    },
    {
      title: "Look at it",
      task: "Draw the points with `plt.scatter`, coloured by class, then `plt.show()`. The plot appears in the Output tab.",
      why: "Always look before you model. The picture shows why a straight line will struggle here.",
      hints: [
        "`X[:, 0]` is every point's first number, `X[:, 1]` the second.",
        "`c=y` colours each point by its class.",
        "Write: `plt.scatter(X[:, 0], X[:, 1], c=y)` and then `plt.show()`",
      ],
      check: py`
        assert wrote("scatter("), "Use plt.scatter(...) to draw the points."
        assert wrote("c=y"), "Colour the points by class with c=y."
        assert wrote("show()"), "Finish with plt.show() so the plot appears."
        praise = "See the two moons? Keep that picture in mind."
      `,
    },
    {
      title: "A straight-line model",
      task: "Fit a `LogisticRegression` on `X` and `y`, then print its score on the same data.",
      why: "Logistic regression draws one straight line between the classes. Its score is the share of points on the right side of that line.",
      hints: [
        "Make the model, then call `.fit(X, y)` on it. `fit` returns the model, so both can go on one line.",
        "`.score(X, y)` gives the accuracy.",
        "Write: `line = LogisticRegression().fit(X, y)` and `print(\"straight line:\", line.score(X, y))`",
      ],
      check: py`
        X = need("X"); y = need("y")
        models = instances("LogisticRegression", fitted=True)
        assert models, "Fit a LogisticRegression with .fit(X, y)."
        score = models[0].score(X, y)
        assert wrote("score("), "Print the model's .score(X, y) to see how often it is right."
        praise = f"{score:.0%}: decent, but a straight line cannot follow the curve of the moons."
      `,
    },
    {
      title: "A curved model",
      task: "Fit an `SVC` with `kernel=\"rbf\"` on `X` and `y` and print its score. Compare it with the straight line.",
      why: "An RBF support vector machine can bend its boundary around the data. It measures how close a point is to known examples instead of which side of a line it falls on.",
      hints: [
        "It works just like the logistic regression: make it, fit it, score it.",
        "The kernel goes inside the brackets: `SVC(kernel=\"rbf\")`.",
        "Write: `curve = SVC(kernel=\"rbf\").fit(X, y)` and `print(\"curve:\", curve.score(X, y))`",
      ],
      check: py`
        X = need("X"); y = need("y")
        curved = [m for m in instances("SVC", fitted=True) if m.kernel == "rbf"]
        assert curved, "Fit an SVC(kernel=\"rbf\") with .fit(X, y)."
        line = instances("LogisticRegression", fitted=True)
        better = curved[0].score(X, y)
        assert not line or better > line[0].score(X, y), "The curved model should beat the straight line here. Check its settings."
        praise = f"{better:.0%}: the curved boundary follows the moons."
      `,
    },
    {
      title: "An honest score",
      task: "Split the data with `train_test_split` (`random_state=0`). Fit a new RBF `SVC` on the training part only and print its score on the test part.",
      why: "Scoring on the same points the model learned from flatters it. The test score tells you how it does on points it has not seen.",
      hints: [
        "Same four pieces as in lesson 1: `X_train, X_test, y_train, y_test`.",
        "Fit with the training pieces, score with the test pieces.",
        "Write: `X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=0)`, then `honest = SVC(kernel=\"rbf\").fit(X_train, y_train)` and `print(\"test:\", honest.score(X_test, y_test))`",
      ],
      check: py`
        X_train = need("X_train"); X_test = need("X_test"); y_test = need("y_test")
        assert 40 <= len(X_test) <= 150, f"The test set has {len(X_test)} points. Keep roughly a quarter of the 300."
        trained = [m for m in instances("SVC", fitted=True) if m.shape_fit_[0] == len(X_train)]
        assert trained, "Fit an SVC on X_train and y_train only."
        assert wrote("score(X_test"), "Print the score on X_test and y_test."
        praise = f"Test accuracy {trained[0].score(X_test, y_test):.0%} on {len(X_test)} unseen points."
      `,
    },
    {
      title: "Overfit on purpose",
      task: "Fit one more `SVC` on the training part with a very large `gamma`: `gamma=300`. Print its training score and its test score.",
      why: "`gamma` controls how wiggly the boundary may get. Too wiggly and the model draws a tiny island around each training point: perfect on training data, much worse on new data. That gap is overfitting.",
      hints: [
        "Set it inside the brackets: `SVC(kernel=\"rbf\", gamma=300)`.",
        "Print two scores: one with the training data, one with the test data.",
        "Write: `wiggly = SVC(kernel=\"rbf\", gamma=300).fit(X_train, y_train)` then print `wiggly.score(X_train, y_train)` and `wiggly.score(X_test, y_test)`",
      ],
      check: py`
        X_train = need("X_train"); y_train = need("y_train"); X_test = need("X_test"); y_test = need("y_test")
        wiggly = [m for m in instances("SVC", fitted=True) if isinstance(m.gamma, (int, float)) and m.gamma >= 100]
        assert wiggly, "Fit an SVC with a very large gamma, such as gamma=300."
        train, test = wiggly[0].score(X_train, y_train), wiggly[0].score(X_test, y_test)
        assert wrote("score(X_train"), "Print the training score too, so you can see the gap."
        praise = f"Training {train:.0%}, test {test:.0%}. A {train - test:.0%} gap: it memorised the training points. That is overfitting."
      `,
    },
  ],
};

const pandasLesson: Lesson = {
  id: "first-look-pandas",
  title: "3 · First look at a dataset",
  summary: "Load a table with pandas, summarise it and find the column that separates the classes.",
  starter: `# Lesson 3 · First look at a dataset
# Follow the steps in the task card, then press "Run & check".
# The last line of your code is shown in Output, so put the thing you want to see last.
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.datasets import load_iris

# Step 1 · Load the table


# Steps 2 to 6 · Explore it (the last line is displayed)

`,
  steps: [
    {
      title: "Load the table",
      task: "Load the iris flowers as a pandas DataFrame called `df`: `load_iris(as_frame=True).frame`. Print `df.shape`.",
      why: "A DataFrame is a table with named columns. Each row is one flower; the columns are its measurements and its species (`target`).",
      hints: [
        "`as_frame=True` asks for pandas output; `.frame` is the whole table including the answer column.",
        "Write: `df = load_iris(as_frame=True).frame` and then `print(df.shape)`",
      ],
      check: py`
        df = need("df")
        assert type(df).__name__ == "DataFrame", "df should be a pandas DataFrame. Use load_iris(as_frame=True).frame."
        assert df.shape == (150, 5), f"df should have 150 rows and 5 columns, but has shape {df.shape}."
        assert "shape" in code, "Also print df.shape."
        praise = "150 flowers, 4 measurements each, plus the species column."
      `,
    },
    {
      title: "Peek at the first rows",
      task: "Make `df.head()` the last line of your code. The table appears in the Output tab.",
      why: "Looking at a few real rows catches problems summaries hide: wrong units, odd text, columns you misunderstood.",
      hints: ["`head()` shows the first 5 rows. Put it alone on the last line, without `print`, so it displays as a table."],
      check: py`
        assert wrote("df.head("), "Write df.head() on the last line."
        praise = "Each row is one flower. target 0, 1 and 2 are the three species."
      `,
    },
    {
      title: "Summarise every column",
      task: "Replace the last line with `df.describe()`.",
      why: "`describe` gives count, mean, spread (std), minimum, quartiles and maximum for every number column in one table.",
      hints: ["Just like head: put `df.describe()` on the last line."],
      check: py`
        assert wrote("df.describe("), "Write df.describe() on the last line."
        praise = "Compare the min and max of each column: petal length ranges far more than sepal width."
      `,
    },
    {
      title: "Count the classes",
      task: "Count how many flowers belong to each species with `value_counts()` on the `target` column.",
      why: "If one class were rare, accuracy could look high just by ignoring it. Always know how balanced your classes are.",
      hints: [
        "Pick a column with square brackets: `df[\"target\"]`.",
        "Write: `df[\"target\"].value_counts()` on the last line.",
      ],
      check: py`
        assert wrote("value_counts("), "Use value_counts() on df[\"target\"]."
        praise = "50 of each: perfectly balanced."
      `,
    },
    {
      title: "Compare the species",
      task: "Store the average of every column per species in a variable called `means`, using `groupby`. Show `means` on the last line.",
      why: "If one measurement differs a lot between species, a model can lean on it. This is how you find useful features before modelling.",
      hints: [
        "`df.groupby(\"target\")` splits the rows by species; `.mean()` averages each group.",
        "Write: `means = df.groupby(\"target\").mean()` and then `means` on the last line.",
      ],
      check: py`
        means = need("means")
        assert type(means).__name__ == "DataFrame" and len(means) == 3, "means should be a table with one row per species. Use df.groupby(\"target\").mean()."
        gaps = (means.max() - means.min()).sort_values(ascending=False)
        praise = f"Biggest difference between species: {gaps.index[0]}. That is the feature a model will lean on."
      `,
    },
    {
      title: "See it",
      task: "Draw a histogram of `petal length (cm)` with `.hist()` and show it with `plt.show()`.",
      why: "A histogram shows how values are spread. Here you should see separate humps: the species barely overlap on petal length.",
      hints: [
        "Pick the column like before, then call `.hist()` on it.",
        "Write: `df[\"petal length (cm)\"].hist(bins=30)` and then `plt.show()`",
      ],
      check: py`
        assert wrote("hist("), "Call .hist() on the petal length column."
        assert wrote("show()"), "Add plt.show() so the chart appears."
        praise = "Two clear groups: one species has short petals, the other two overlap a little."
      `,
    },
  ],
};

const torchLesson: Lesson = {
  id: "torch-loop",
  title: "4 · A PyTorch training loop",
  summary: "Write the training loop that Keras' fit() hides from you.",
  starter: `# Lesson 4 · A PyTorch training loop
# Follow the steps in the task card, then press "Run & check".
import torch
from torch import nn
import mle

torch.manual_seed(0)

# Step 1 · Make the data


# Step 2 · Build the network


# Step 3 · Loss and optimizer


# Steps 4 and 5 · The training loop

`,
  steps: [
    {
      title: "Make the data",
      task: "Make `X`: 512 random points with 2 numbers between -1 and 1. Make `y`: 1 when the two numbers have the same sign, else 0, shaped as 512 rows by 1 column of floats.",
      why: "PyTorch works with tensors, which are NumPy-like arrays that can also track gradients. The label rule (same sign or not) is a pattern no straight line can learn.",
      hints: [
        "`torch.rand(512, 2)` gives numbers from 0 to 1. Multiply by 2 and subtract 1 to get -1 to 1.",
        "Two numbers share a sign when their product is positive. `(X[:, 0] * X[:, 1]) > 0` gives True/False per row; `.float()` turns that into 1.0/0.0 and `.unsqueeze(1)` makes it a column.",
        "Write: `X = torch.rand(512, 2) * 2 - 1` and `y = ((X[:, 0] * X[:, 1]) > 0).float().unsqueeze(1)`",
      ],
      check: py`
        X = need("X"); y = need("y")
        assert tuple(X.shape) == (512, 2), f"X should be 512 rows of 2 numbers, but its shape is {tuple(X.shape)}."
        assert float(X.min()) < -0.5 and float(X.max()) > 0.5 and float(X.min()) >= -1, "X should go from -1 to 1. Multiply by 2, then subtract 1."
        assert tuple(y.shape) == (512, 1), f"y should be a column of 512 values, but its shape is {tuple(y.shape)}. Use .unsqueeze(1)."
        assert y.dtype == torch.float32, "y should hold floats (1.0 and 0.0). Add .float()."
        expected = ((X[:, 0] * X[:, 1]) > 0).float().unsqueeze(1)
        assert bool((expected == y).all()), "Some labels are wrong: y should be 1 exactly when both numbers have the same sign."
        praise = f"{int(y.sum())} points labelled 1, {512 - int(y.sum())} labelled 0."
      `,
    },
    {
      title: "Build the network",
      task: "Build `net` with `nn.Sequential`: `nn.Linear(2, 16)`, `nn.Tanh()`, `nn.Linear(16, 1)`. Then call `mle.watch(net)` and press Run to see it in 3D.",
      why: "`nn.Linear(a, b)` is PyTorch's Dense layer: a inputs, b outputs. `Tanh` is the activation that bends the boundary. Unlike Keras, you must match each layer's input size to the previous output size yourself.",
      hints: [
        "The first Linear takes 2 numbers (each point has 2). The last gives 1 number (one score).",
        "Write:\n```python\nnet = nn.Sequential(nn.Linear(2, 16), nn.Tanh(), nn.Linear(16, 1))\nmle.watch(net)\n```",
      ],
      check: py`
        net = need("net")
        linears = [m for m in net.modules() if isinstance(m, nn.Linear)]
        assert len(linears) >= 2, "Use at least two nn.Linear layers with an activation between them."
        assert linears[0].in_features == 2, f"The first Linear takes {linears[0].in_features} inputs, but each point has 2."
        assert linears[-1].out_features == 1, f"The last Linear gives {linears[-1].out_features} outputs. You need 1 score per point."
        assert any(isinstance(m, (nn.Tanh, nn.ReLU)) for m in net.modules()), "Put an activation such as nn.Tanh() between the Linear layers."
        assert wrote("mle.watch(net)"), "Call mle.watch(net) to see it in the 3D view."
        praise = f"{sum(p.numel() for p in net.parameters())} weights to learn."
      `,
    },
    {
      title: "Loss and optimizer",
      task: "Create `loss_fn = nn.BCEWithLogitsLoss()` and `opt`, an Adam optimizer over `net.parameters()` with `lr=0.02`.",
      why: "The loss scores how wrong the raw outputs are for 0/1 labels. The optimizer holds the network's weights and knows how to nudge them. `lr` (learning rate) is how big each nudge is.",
      hints: [
        "Optimizers live in `torch.optim`.",
        "Write: `loss_fn = nn.BCEWithLogitsLoss()` and `opt = torch.optim.Adam(net.parameters(), lr=0.02)`",
      ],
      check: py`
        loss_fn = need("loss_fn"); opt = need("opt"); net = need("net")
        assert isinstance(loss_fn, nn.BCEWithLogitsLoss), "loss_fn should be nn.BCEWithLogitsLoss()."
        assert isinstance(opt, torch.optim.Optimizer), "opt should be an optimizer, e.g. torch.optim.Adam(...)."
        watched = {id(p) for group in opt.param_groups for p in group["params"]}
        assert all(id(p) in watched for p in net.parameters()), "Give the optimizer net.parameters() so it can update the network."
        praise = f"{type(opt).__name__} with learning rate {opt.param_groups[0]['lr']}."
      `,
    },
    {
      title: "The training loop",
      task: "Loop 300 times. Each time: clear old gradients, run the network on `X`, compute the loss against `y`, backpropagate, and step the optimizer.",
      why: "This is what fit() does for you. `zero_grad` forgets the last step's gradients, `backward` works out how each weight affected the loss, and `step` moves each weight a little in the direction that lowers it.",
      hints: [
        "The order inside the loop: `opt.zero_grad()`, `out = net(X)`, `loss = loss_fn(out, y)`, `loss.backward()`, `opt.step()`.",
        "Write:\n```python\nfor step in range(300):\n    opt.zero_grad()\n    out = net(X)\n    loss = loss_fn(out, y)\n    loss.backward()\n    opt.step()\n```",
      ],
      check: py`
        net = need("net"); X = need("X"); y = need("y"); loss_fn = need("loss_fn")
        for part, name in [("zero_grad()", "opt.zero_grad()"), ("backward()", "loss.backward()"), ("step()", "opt.step()")]:
            assert wrote(part), f"The loop is missing {name}."
        with torch.no_grad():
            final = float(loss_fn(net(X), y))
        assert final < 0.45, f"The loss is still {final:.2f}. Check the order of the five lines, or loop more times."
        praise = f"Loss is down to {final:.3f}. You wrote the loop that fit() hides."
      `,
    },
    {
      title: "Watch it learn",
      task: "Inside the loop, every 5 steps, call `mle.log(step=step, loss=loss.item())` so the Training chart draws the loss.",
      why: "PyTorch has no built-in progress chart. Logging a number every few steps is how you see whether training is working. `.item()` turns a one-number tensor into a plain Python number.",
      hints: [
        "`if step % 5 == 0:` is true every fifth step.",
        "Add inside the loop, at the end:\n```python\n    if step % 5 == 0:\n        mle.log(step=step, loss=loss.item())\n```",
      ],
      check: py`
        net = need("net"); X = need("X"); y = need("y")
        assert wrote("mle.log("), "Call mle.log(step=step, loss=loss.item()) inside the loop."
        with torch.no_grad():
            accuracy = float(((net(X) > 0).float() == y).float().mean())
        praise = f"The chart shows the loss falling, and the network now labels {accuracy:.0%} of points correctly."
      `,
    },
  ],
};

export const LESSONS: Lesson[] = [network, boundary, pandasLesson, torchLesson];

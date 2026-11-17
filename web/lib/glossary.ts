/**
 * Built-in explanations. They answer instantly and work offline; the AI tutor (optional)
 * handles everything else. `match` lists the words that point to an entry.
 */
export type Entry = { term: string; match: string[]; text: string; example?: string };

export const GLOSSARY: Entry[] = [
  {
    term: "Dense layer",
    match: ["dense", "fully connected", "linear layer", "nn.linear"],
    text: "A layer where every input is connected to every unit. Each unit multiplies each input by a weight, adds them up with a bias, then applies the activation. `layers.Dense(32)` makes 32 such units. The weights are what training learns. PyTorch calls it `nn.Linear(inputs, outputs)`.",
    example: 'layers.Dense(32, activation="relu")   # 32 units, each sees every input',
  },
  {
    term: "ReLU",
    match: ["relu", "rectified"],
    text: "An activation function: negative numbers become 0, positive numbers pass through unchanged. It is cheap to compute and lets stacked layers learn curved patterns. Without an activation, any stack of Dense layers would collapse into one straight-line model.",
    example: "relu(-3) = 0      relu(2.5) = 2.5",
  },
  {
    term: "Activation function",
    match: ["activation", "nonlinear", "non-linear", "non linearity"],
    text: "The function a layer applies to each unit's sum before passing it on. It adds the bend that lets a network learn non-straight patterns. Common ones: `relu` for hidden layers, `softmax` for picking one of several classes, `sigmoid` for yes/no, none (linear) for predicting a number.",
  },
  {
    term: "Softmax",
    match: ["softmax"],
    text: "Turns a list of scores into probabilities that are all positive and add up to 1. Used on the last layer when the model must choose one class out of several. The largest probability is the model's guess.",
    example: "scores [2.0, 1.0, 0.1]  →  softmax  →  [0.66, 0.24, 0.10]",
  },
  {
    term: "Sigmoid",
    match: ["sigmoid", "logistic function"],
    text: "Squashes any number into the range 0 to 1, so it can be read as a probability. Used on a single output unit for yes/no problems.",
  },
  {
    term: "Tanh",
    match: ["tanh"],
    text: "An activation that squashes numbers into -1 to 1. Like a stretched sigmoid centred on zero. Common in small networks and recurrent layers.",
  },
  {
    term: "Sequential model",
    match: ["sequential", "keras.sequential", "nn.sequential"],
    text: "A model built as a simple stack: the output of each layer feeds the next, in the order you list them. Fine for most beginner networks. Keras: `keras.Sequential([...])`. PyTorch: `nn.Sequential(...)`.",
  },
  {
    term: "Input layer",
    match: ["input(", "layers.input", "input shape", "input_shape", "shape=("],
    text: "Tells Keras the size of one example, without the batch. `layers.Input(shape=(64,))` means each example is a list of 64 numbers. The trailing comma makes `(64,)` a tuple. It has no weights.",
  },
  {
    term: "Units / neurons",
    match: ["unit", "neuron", "node"],
    text: "One unit is one output of a layer: a weighted sum of the inputs plus a bias, passed through the activation. More units means the layer can represent more patterns, but also more weights to learn and a higher risk of memorising.",
  },
  {
    term: "Weights and biases",
    match: ["weight", "bias", "parameter", "params"],
    text: "The numbers a network learns. Each connection has a weight (how strongly an input pushes a unit up or down); each unit has a bias (its starting offset). A Dense layer from 64 inputs to 32 units has 64×32 weights + 32 biases = 2,080 parameters. In the 3D view, green connections are positive weights and red are negative.",
  },
  {
    term: "compile()",
    match: ["compile"],
    text: "Prepares a Keras model for training by choosing three things: the loss (how wrongness is measured), the optimizer (how weights are updated) and the metrics (extra numbers to display). It does not train anything yet.",
    example: 'model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])',
  },
  {
    term: "fit()",
    match: ["fit(", ".fit", " fit", "fitting"],
    text: "Trains a model on data. In Keras, `model.fit(X, y, epochs=20)` loops over the data in batches, measures the loss and updates the weights. In scikit-learn, `model.fit(X, y)` learns in one call. Either way, after fit the model holds what it learned.",
  },
  {
    term: "evaluate()",
    match: ["evaluate"],
    text: "Measures a trained Keras model on data without changing it. Returns the loss followed by each metric you chose in compile, e.g. `loss, acc = model.evaluate(X_test, y_test)`.",
  },
  {
    term: "predict()",
    match: ["predict"],
    text: "Runs the model on inputs and returns its outputs. For a softmax classifier you get one row of probabilities per example; `.argmax(axis=1)` picks the most likely class.",
  },
  {
    term: "score()",
    match: ["score("],
    text: "scikit-learn's quick evaluation: accuracy for classifiers, R² for regressors. `model.score(X_test, y_test)`.",
  },
  {
    term: "Loss",
    match: ["loss", "cost function", "objective"],
    text: "One number that says how wrong the model's predictions are. Training is the search for weights that make it small. The loss chart should fall over time; if it rises or jumps around, the learning rate may be too high.",
  },
  {
    term: "Crossentropy",
    match: ["crossentropy", "cross entropy", "cross-entropy", "log loss", "bce"],
    text: "The usual loss for classification. It is small when the model gives a high probability to the right class and very large when it is confidently wrong. Use `sparse_categorical_crossentropy` when labels are plain integers like 7, `categorical_crossentropy` when they are one-hot lists, and binary crossentropy (`BCEWithLogitsLoss` in PyTorch) for yes/no.",
  },
  {
    term: "Mean squared error",
    match: ["mse", "mean squared", "squared error", "mae", "mean absolute"],
    text: "Losses for predicting numbers. MSE averages the squared differences, so large mistakes count a lot. MAE averages the plain differences, so it is easier to read: 'off by 3 on average'.",
  },
  {
    term: "Optimizer",
    match: ["optimizer", "optimiser", "sgd", "gradient descent"],
    text: "The rule for changing the weights after each batch. Plain gradient descent moves each weight a small step against its gradient. Adam adapts the step size per weight and is a good default.",
  },
  {
    term: "Adam",
    match: ["adam"],
    text: "A popular optimizer. It keeps a running average of each weight's recent gradients and their size, and uses them to pick a sensible step for every weight. Works well with little tuning; `lr` around 0.001 is its usual starting point.",
  },
  {
    term: "Learning rate",
    match: ["learning rate", "lr=", " lr", "step size"],
    text: "How big each weight update is. Too small and training crawls; too large and the loss bounces around or explodes. Often the first setting to try changing when training misbehaves.",
  },
  {
    term: "Gradient and backpropagation",
    match: ["gradient", "backprop", "backward", "derivative"],
    text: "A gradient says how much the loss would change if one weight were nudged up a little. Backpropagation computes it for every weight at once, working backwards from the loss through each layer. In PyTorch, `loss.backward()` does this.",
  },
  {
    term: "zero_grad()",
    match: ["zero_grad"],
    text: "PyTorch adds new gradients onto old ones by default. `opt.zero_grad()` clears them at the start of each step so every update uses only the current batch.",
  },
  {
    term: "optimizer.step()",
    match: ["step()", "opt.step", "optimizer.step"],
    text: "Applies one update: moves every weight a little in the direction its gradient says will lower the loss. Call it after `loss.backward()`.",
  },
  {
    term: "Epoch",
    match: ["epoch"],
    text: "One full pass over all the training data. Training for 20 epochs means the model sees every example 20 times. More epochs can help until the validation loss stops improving; after that the model starts memorising.",
  },
  {
    term: "Batch size",
    match: ["batch"],
    text: "How many examples the model looks at before each weight update. Keras uses 32 by default. Smaller batches give noisier but more frequent updates; larger ones are smoother and faster per epoch on a GPU.",
  },
  {
    term: "Training, validation and test sets",
    match: ["train_test_split", "test set", "training set", "validation", "split", "x_train", "x_test", "held out", "held-out"],
    text: "Training data is what the model learns from. Validation data is watched during training to tune choices. Test data is kept sealed until the end to give an honest score. `train_test_split(X, y)` shuffles and splits, keeping 25% for testing by default.",
  },
  {
    term: "random_state",
    match: ["random_state", "seed", "manual_seed"],
    text: "Fixes the random number generator so shuffles and random starts are the same every run. That makes results repeatable, so a change in the score comes from your change, not luck.",
  },
  {
    term: "Overfitting",
    match: ["overfit", "over-fit", "memoris", "memoriz", "underfit"],
    text: "When a model learns the training data too closely, including its noise, and does worse on new data. Sign: training score keeps improving while test or validation score stalls or gets worse. Fixes: more data, a simpler model, fewer epochs, dropout or regularisation. Underfitting is the opposite: too simple to learn the pattern.",
  },
  {
    term: "Dropout",
    match: ["dropout"],
    text: "During training, randomly switches off a share of a layer's units on each step (e.g. 30% with `layers.Dropout(0.3)`). The network cannot rely on any single unit, which reduces overfitting. It is turned off automatically when predicting.",
  },
  {
    term: "Accuracy",
    match: ["accuracy", "acc"],
    text: "The share of predictions that are right. Easy to read but misleading when classes are unbalanced: if 95% of emails are not spam, a model that always says 'not spam' scores 95%.",
  },
  {
    term: "Precision, recall and F1",
    match: ["precision", "recall", "f1"],
    text: "Precision: when the model says 'yes', how often is it right? Recall: of all real 'yes' cases, how many did it find? F1 combines both into one number. The Analytics section shows all three for each class.",
  },
  {
    term: "Confusion matrix",
    match: ["confusion"],
    text: "A table of actual class (rows) against predicted class (columns). The diagonal holds correct answers; everything off the diagonal shows which classes get mixed up.",
  },
  {
    term: "Scaling / normalisation",
    match: ["scale", "scaling", "normali", "standardscaler", "/ 16", "/16", "/ 255"],
    text: "Putting inputs on a similar small range, such as 0 to 1, or mean 0 and spread 1. Networks and many classic models learn faster and more reliably on scaled data. Fit the scaler on training data only, then apply it to test data.",
  },
  {
    term: "X and y",
    match: ["x and y", "features", "labels", "target"],
    text: "By convention `X` (capital, a table) holds the inputs, one row per example and one column per feature. `y` (small, a list) holds the answer for each row. The model learns to map rows of X to values of y.",
  },
  {
    term: "Shape",
    match: ["shape", "dimension", "reshape", "unsqueeze"],
    text: "The size of an array along each axis. `(1797, 64)` means 1,797 rows and 64 columns. Many errors are shape mismatches: a layer expected a different number of columns than it was given. `unsqueeze(1)` in PyTorch adds an axis, turning 512 values into a 512×1 column.",
  },
  {
    term: "Tensor",
    match: ["tensor", "torch."],
    text: "PyTorch's array type. Like a NumPy array, but it can live on a GPU and record the operations done to it so gradients can be computed. `.item()` turns a one-number tensor into a plain Python number.",
  },
  {
    term: "Logistic regression",
    match: ["logistic", "logisticregression"],
    text: "Despite the name, a classifier. It draws a straight line (or flat surface) between classes and turns the distance from it into a probability with a sigmoid. Fast, simple and a good first baseline.",
  },
  {
    term: "SVM / SVC",
    match: ["svm", "svc", "support vector", "kernel", "gamma"],
    text: "A support vector machine finds the boundary with the widest gap between classes. With `kernel=\"rbf\"` the boundary can curve. `gamma` sets how far each training point's influence reaches: large gamma gives a wiggly boundary that can overfit. `C` sets how much it tolerates mistakes.",
  },
  {
    term: "Random forest",
    match: ["random forest", "randomforest", "decision tree", "tree"],
    text: "Many decision trees, each trained on a random sample of rows and columns, voting together. Strong on tables with little tuning, and it can tell you which inputs it relied on.",
  },
  {
    term: "Conv2D",
    match: ["conv2d", "convolution", "cnn", "filter", "kernel_size"],
    text: "A convolutional layer slides small filters (e.g. 3×3) across an image. Each filter learns to light up for one pattern, such as an edge or a corner, wherever it appears. Stacked, they build up from edges to shapes to objects.",
  },
  {
    term: "Pooling",
    match: ["pooling", "maxpool", "max pool", "globalaverage"],
    text: "Shrinks an image-like layer by summarising small patches. Max pooling keeps the strongest value in each 2×2 patch. It cuts computation and makes the model care less about exact positions.",
  },
  {
    term: "Flatten",
    match: ["flatten"],
    text: "Turns a grid (like a 28×28 image) into one long list of numbers so a Dense layer can use it. It has no weights.",
  },
  {
    term: "import",
    match: ["import"],
    text: "Loads code someone else wrote so you can use it. `import keras` makes the name `keras` available; `from keras import layers` brings in just `layers`. It has to run before the line that uses the name.",
    example: "from sklearn.datasets import load_digits",
  },
  {
    term: "print()",
    match: ["print"],
    text: "Shows a value in the Console. Only the last line of a cell is shown automatically, so use `print` to see anything earlier.",
  },
  {
    term: "Keras",
    match: ["keras", "layers"],
    text: "A library for building neural networks from ready-made pieces. `keras.Sequential` stacks layers, `layers` holds them (`Dense`, `Conv2D`…), then you `compile`, `fit` and `evaluate`. Here it runs on PyTorch underneath.",
  },
  {
    term: "scikit-learn",
    match: ["sklearn", "scikit"],
    text: "A library of classic machine-learning tools: datasets (`load_digits`, `make_moons`), models (`LogisticRegression`, `SVC`), and helpers like `train_test_split`. Every model has `.fit(X, y)` to learn and `.predict(X)` / `.score(X, y)` to use it.",
  },
  {
    term: "NumPy",
    match: ["numpy", "np.", "array"],
    text: "The library for arrays: grids of numbers you can do maths on all at once. `X / 16` divides every number in `X`, and `X[:, 0]` takes the first column.",
  },
  {
    term: "PyTorch",
    match: ["torch", "nn."],
    text: "A library for tensors and neural networks where you write the training loop yourself. `nn.Linear` is its Dense layer, `nn.Sequential` stacks layers, and `torch.optim` holds the optimizers.",
  },
  {
    term: "matplotlib",
    match: ["matplotlib", "plt", "scatter", "plot"],
    text: "The plotting library. `plt.scatter(x, y, c=labels)` draws points coloured by label, `plt.plot` draws lines, and `plt.show()` sends the picture to the Output tab.",
  },
  {
    term: "DataFrame",
    match: ["dataframe", "pandas", "pd."],
    text: "pandas' table type: named columns, one row per record. `df.head()` shows the first rows, `df.describe()` summarises number columns, `df[\"col\"]` picks a column.",
  },
  {
    term: "groupby()",
    match: ["groupby", "group by"],
    text: "Splits a table into groups by the values of a column, then summarises each group. `df.groupby(\"target\").mean()` gives the average of every column for each class.",
  },
  {
    term: "value_counts()",
    match: ["value_counts"],
    text: "Counts how often each value appears in a column. Use it to check whether your classes are balanced.",
  },
  {
    term: "Histogram",
    match: ["hist", "histogram", "distribution"],
    text: "A bar chart of how values are spread: the range is cut into bins and each bar shows how many values fall in that bin.",
  },
  {
    term: "NameError",
    match: ["nameerror", "is not defined"],
    text: "Python met a name it does not know. Usually a typo or a capital letter (`x` is not `X`), a variable used before the line that creates it, or code that has not been run yet. Find the name in the error message and check its spelling where you created it.",
  },
  {
    term: "SyntaxError and IndentationError",
    match: ["syntaxerror", "indentationerror", "invalid syntax", "unexpected indent", "expected ':'", "was never closed"],
    text: "Python could not read the code at all, so nothing ran. Look at the line the error points to and the one above it: a missing bracket, quote or colon, or lines inside a `for` loop that are not indented by 4 spaces.",
  },
  {
    term: "ValueError: shapes don't match",
    match: ["valueerror", "shape mismatch", "incompatible shape", "expected axis", "found input variables with inconsistent"],
    text: "The data's size does not fit what the code expects. Print the `.shape` of each array involved. Common causes: X and y with different numbers of rows, or a model whose input size differs from the number of columns.",
  },
  {
    term: "TypeError",
    match: ["typeerror", "not callable", "unexpected keyword", "missing 1 required", "takes 1 positional"],
    text: "A function got the wrong kind of thing: a misspelled argument name, a missing argument, or calling something that is not a function. Compare your call with an example of how that function is used.",
  },
  {
    term: "AttributeError",
    match: ["attributeerror", "has no attribute"],
    text: "You used `.something` on an object that does not have it. Often a typo (`.fit` vs `.fitt`), wrong capital letters, or the variable holds a different kind of object than you think. `print(type(x))` shows what it really is.",
  },
  {
    term: "KeyError",
    match: ["keyerror"],
    text: "You asked a table or dictionary for a key that is not there, most often a column name with a typo or different spaces. `print(df.columns)` lists the exact names.",
  },
  {
    term: "ImportError and ModuleNotFoundError",
    match: ["importerror", "modulenotfounderror", "no module named", "cannot import name"],
    text: "Python could not find the library or the name you imported. Check the spelling against the import lines in an example; `from keras import layers` and `from sklearn.svm import SVC` are case-sensitive.",
  },
  {
    term: "mle.watch() and mle.log()",
    match: ["mle.watch", "mle.log", "mle."],
    text: "ML-E helpers. `mle.watch(model)` shows a PyTorch or Keras model in the 3D view. `mle.log(step=..., loss=...)` sends numbers to the Training chart. Keras `fit()` is tracked automatically, so it needs neither.",
  },
];

const clean = (text: string) => ` ${text.toLowerCase().replace(/\s+/g, " ")} `;

/** The entries a question points to, best match first. */
export function searchGlossary(question: string, limit = 3): Entry[] {
  const q = clean(question);
  return GLOSSARY
    .map((entry) => {
      const hits = entry.match.filter((word) => q.includes(word.toLowerCase()));
      return { entry, score: hits.reduce((best, word) => Math.max(best, word.length), 0) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}

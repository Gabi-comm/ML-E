# A small neural network that learns to read handwritten digits.
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

from mle_server.parse import parse_model


def sizes(code):
    return [(l["type"], l["units"], l["activation"]) for l in parse_model(code)["layers"]]


def test_sequential_list():
    code = """
import keras
from keras import layers
model = keras.Sequential([
    layers.Dense(64, activation="relu"),
    layers.Dense(32, activation="relu"),
    layers.Dense(10, activation="softmax"),
])
"""
    assert sizes(code) == [("Dense", 64, "relu"), ("Dense", 32, "relu"), ("Dense", 10, "softmax")]


def test_model_add_and_input_shape():
    code = """
model = Sequential()
model.add(Input(shape=(784,)))
model.add(Dense(units=16))
"""
    assert sizes(code) == [("Input", 784, None), ("Dense", 16, None)]


def test_image_input_and_conv_filters():
    code = "m = Sequential([Input(shape=(28, 28, 1)), Conv2D(32, 3), Flatten(), Dense(10)])"
    result = parse_model(code)["layers"]
    assert result[0]["units"] == 784 and result[0]["shape"] == [28, 28, 1]
    assert [(l["type"], l["units"]) for l in result[1:]] == [("Conv2D", 32), ("Flatten", None), ("Dense", 10)]


def test_torch_sequential_adds_implicit_input():
    code = "net = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 3))"
    assert sizes(code) == [("Input", 4, None), ("Linear", 8, None), ("ReLU", None, None), ("Linear", 3, None)]


def test_functional_api_and_named_constant():
    code = """
hidden = 48
inputs = keras.Input(shape=(20,))
x = layers.Dense(hidden, activation="relu")(inputs)
outputs = layers.Dense(1)(x)
"""
    assert sizes(code) == [("Input", 20, None), ("Dense", 48, "relu"), ("Dense", 1, None)]


def test_unknown_size_is_none():
    assert sizes("m = Sequential([Dense(n_units)])") == [("Dense", None, None)]


def test_syntax_error():
    result = parse_model("model = Sequential([Dense(64,")
    assert result["ok"] is False and result["error"] and result["layers"] == []


def test_no_model():
    assert parse_model("print('hello')") == {"ok": True, "layers": []}

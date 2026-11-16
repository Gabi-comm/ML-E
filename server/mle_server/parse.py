"""Static model extraction: read Python source, find layer definitions, never execute it."""
from __future__ import annotations

import ast
from math import prod
from typing import Any

# layer name -> where its "size" lives: (positional index, keyword names)
_SIZED: dict[str, tuple[int, tuple[str, ...]]] = {
    # Keras
    "Dense": (0, ("units",)),
    "Conv1D": (0, ("filters",)),
    "Conv2D": (0, ("filters",)),
    "Conv3D": (0, ("filters",)),
    "Conv2DTranspose": (0, ("filters",)),
    "SeparableConv2D": (0, ("filters",)),
    "LSTM": (0, ("units",)),
    "GRU": (0, ("units",)),
    "SimpleRNN": (0, ("units",)),
    "Embedding": (1, ("output_dim",)),
    # PyTorch
    "Linear": (1, ("out_features",)),
    "Conv1d": (1, ("out_channels",)),
    "Conv2d": (1, ("out_channels",)),
    "Conv3d": (1, ("out_channels",)),
    "ConvTranspose2d": (1, ("out_channels",)),
}

# PyTorch layers whose first argument tells us the size of what feeds them
_TORCH_IN: dict[str, tuple[str, ...]] = {
    "Linear": ("in_features",),
    "Conv1d": ("in_channels",),
    "Conv2d": ("in_channels",),
    "Conv3d": ("in_channels",),
}

_UNSIZED = {
    "Flatten", "Dropout", "BatchNormalization", "LayerNormalization", "Activation",
    "MaxPooling1D", "MaxPooling2D", "AveragePooling2D", "GlobalAveragePooling2D",
    "GlobalMaxPooling2D", "Reshape", "Rescaling", "Normalization", "Bidirectional",
    "MultiHeadAttention", "Add", "Concatenate",
    "ReLU", "LeakyReLU", "Sigmoid", "Tanh", "Softmax", "GELU", "ELU", "SiLU",
    "MaxPool2d", "AvgPool2d", "AdaptiveAvgPool2d", "BatchNorm1d", "BatchNorm2d",
    "LayerNorm", "Dropout2d",
}

_INPUTS = {"Input", "InputLayer"}


def _call_name(node: ast.Call) -> str | None:
    f = node.func
    if isinstance(f, ast.Name):
        return f.id
    if isinstance(f, ast.Attribute):
        return f.attr
    return None


class _Resolver:
    """Resolve literals and simple module-level constants like `hidden = 64`."""

    def __init__(self, tree: ast.Module) -> None:
        self.consts: dict[str, Any] = {}
        for stmt in tree.body:
            if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1:
                target = stmt.targets[0]
                if isinstance(target, ast.Name):
                    value = self.value(stmt.value)
                    if value is not None:
                        self.consts[target.id] = value

    def value(self, node: ast.AST | None) -> Any:
        if node is None:
            return None
        if isinstance(node, ast.Name):
            return self.consts.get(node.id)
        if isinstance(node, (ast.Tuple, ast.List)):
            return tuple(self.value(e) for e in node.elts)
        try:
            return ast.literal_eval(node)
        except Exception:
            return None


def _arg(node: ast.Call, index: int, names: tuple[str, ...]) -> ast.AST | None:
    for kw in node.keywords:
        if kw.arg in names:
            return kw.value
    if 0 <= index < len(node.args):
        return node.args[index]
    return None


def _size_of_shape(shape: Any) -> int | None:
    if isinstance(shape, int):
        return shape
    if isinstance(shape, tuple):
        dims = [d for d in shape if isinstance(d, int)]
        if dims:
            return prod(dims)
    return None


def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def parse_model(code: str) -> dict[str, Any]:
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return {"ok": False, "error": exc.msg, "line": exc.lineno, "layers": []}
    except Exception as exc:  # e.g. null bytes
        return {"ok": False, "error": str(exc), "line": None, "layers": []}

    resolve = _Resolver(tree)
    calls = [
        n for n in ast.walk(tree)
        if isinstance(n, ast.Call) and _call_name(n) in (_SIZED.keys() | _UNSIZED | _INPUTS)
    ]
    calls.sort(key=lambda n: (n.lineno, n.col_offset))

    layers: list[dict[str, Any]] = []

    def add(kind: str, units: int | None, activation: str | None, line: int, shape: Any = None) -> None:
        layers.append({
            "type": kind, "units": units, "activation": activation, "line": line,
            "shape": list(shape) if isinstance(shape, tuple) else None,
        })

    for call in calls:
        name = _call_name(call)
        assert name is not None
        activation = resolve.value(_arg(call, -1, ("activation",)))
        activation = activation if isinstance(activation, str) else None

        if name in _INPUTS:
            shape = resolve.value(_arg(call, 0, ("shape", "input_shape")))
            add("Input", _size_of_shape(shape), None, call.lineno, shape)
            continue

        if not layers:
            # Implicit input: old-style Keras kwargs, or PyTorch's in_features.
            shape = resolve.value(_arg(call, -1, ("input_shape", "input_dim")))
            if shape is None and name in _TORCH_IN:
                shape = resolve.value(_arg(call, 0, _TORCH_IN[name]))
            size = _size_of_shape(shape)
            if size is not None:
                add("Input", size, None, call.lineno, shape if isinstance(shape, tuple) else None)

        if name in _SIZED:
            index, names = _SIZED[name]
            add(name, _int(resolve.value(_arg(call, index, names))), activation, call.lineno)
        else:
            add(name, None, activation, call.lineno)

    return {"ok": True, "layers": layers}

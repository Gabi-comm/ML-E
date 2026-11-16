"""ML-E in-kernel helpers.

Everything here runs inside the Python kernel next to your code and sends
small JSON events to the ML-E visualiser.

    import mle
    mle.log(loss=0.42, acc=0.9)     # plot any numbers you like
    mle.watch(torch_model)          # show a PyTorch model in 3D

Keras models need nothing: `model.fit(...)` is hooked automatically.
"""
from __future__ import annotations

import time
from typing import Any

MIME = "application/vnd.mle+json"
MAX_NODES = 16  # weights are sampled down to this many nodes per layer

_step = 0


def emit(event: dict[str, Any]) -> None:
    """Send one event to the visualiser."""
    from IPython.display import publish_display_data

    publish_display_data({MIME: event, "text/plain": ""})


def log(step: int | None = None, **metrics: float) -> None:
    """Plot named numbers, e.g. mle.log(loss=0.3, acc=0.91)."""
    global _step
    _step = _step + 1 if step is None else int(step)
    emit({"kind": "metrics", "step": _step, "values": {k: float(v) for k, v in metrics.items()}})


def _torch_layers(model: Any) -> list[dict[str, Any]]:
    layers: list[dict[str, Any]] = []
    for name, module in model.named_modules():
        if any(True for _ in module.children()):
            continue  # containers
        units = getattr(module, "out_features", None) or getattr(module, "out_channels", None)
        if not layers:
            first = getattr(module, "in_features", None) or getattr(module, "in_channels", None)
            if first:
                layers.append({"name": "input", "type": "Input", "units": int(first), "activation": None, "params": 0})
        layers.append({
            "name": name or type(module).__name__,
            "type": type(module).__name__,
            "units": int(units) if units else None,
            "activation": None,
            "params": int(sum(p.numel() for p in module.parameters())),
        })
    return layers


def watch(model: Any) -> None:
    """Show a model in the 3D view (PyTorch nn.Module or Keras model)."""
    if hasattr(model, "named_modules"):
        emit({"kind": "model", "layers": _torch_layers(model)})
    elif hasattr(model, "layers"):
        emit({"kind": "model", "layers": _keras_layers(model)})
    else:
        raise TypeError("mle.watch expects a Keras model or a torch.nn.Module")


def _last_dim(shape: Any) -> int | None:
    try:
        dims = [d for d in tuple(shape)[1:] if isinstance(d, int)]
    except TypeError:
        return None
    if not dims:
        return None
    return dims[-1]


def _keras_layers(model: Any) -> list[dict[str, Any]]:
    layers: list[dict[str, Any]] = []
    try:
        shape = tuple(model.input_shape)
        dims = [d for d in shape[1:] if isinstance(d, int)]
        size = 1
        for d in dims:
            size *= d
        layers.append({"name": "input", "type": "Input", "units": size if dims else None,
                       "activation": None, "params": 0, "shape": dims})
    except Exception:
        pass
    for layer in model.layers:
        if type(layer).__name__ == "InputLayer":
            continue
        try:
            units = _last_dim(layer.output.shape)
        except Exception:
            units = getattr(layer, "units", None) or getattr(layer, "filters", None)
        activation = getattr(getattr(layer, "activation", None), "__name__", None)
        try:
            params = int(layer.count_params())
        except Exception:
            params = 0
        layers.append({"name": layer.name, "type": type(layer).__name__, "units": units,
                       "activation": None if activation == "linear" else activation, "params": params})
    return layers


def _keras_weights(model: Any) -> list[dict[str, Any]]:
    """Sampled weight matrices, indexed to match _keras_layers output."""
    out: list[dict[str, Any]] = []
    index = 0  # index 0 is the input entry
    for layer in model.layers:
        if type(layer).__name__ == "InputLayer":
            continue
        index += 1
        try:
            weights = layer.get_weights()
        except Exception:
            continue
        if weights and getattr(weights[0], "ndim", 0) == 2:
            w = weights[0][:MAX_NODES, :MAX_NODES]
            out.append({"layer": index, "w": [[round(float(v), 4) for v in row] for row in w]})
    return out


def _make_callback() -> Any:
    import keras

    class LiveCallback(keras.callbacks.Callback):
        """Streams loss, metrics and sampled weights while a Keras model trains."""

        def on_train_begin(self, logs=None):
            self._last = 0.0
            self._step = 0
            emit({"kind": "model", "layers": _keras_layers(self.model)})
            emit({"kind": "train_begin", "epochs": int(self.params.get("epochs") or 0),
                  "weights": _keras_weights(self.model)})

        def on_train_batch_end(self, batch, logs=None):
            self._step += 1
            now = time.monotonic()
            if logs and "loss" in logs and now - self._last > 0.08:
                self._last = now
                emit({"kind": "batch", "step": self._step, "loss": float(logs["loss"])})

        def on_epoch_end(self, epoch, logs=None):
            clean = {}
            for key, value in (logs or {}).items():
                try:
                    clean[key] = float(value)
                except (TypeError, ValueError):
                    pass
            emit({"kind": "epoch", "epoch": int(epoch) + 1, "epochs": int(self.params.get("epochs") or 0),
                  "step": self._step, "logs": clean, "weights": _keras_weights(self.model)})

        def on_train_end(self, logs=None):
            emit({"kind": "train_end"})

    return LiveCallback


def _patch_keras() -> bool:
    import keras

    if getattr(keras.Model.fit, "_mle", False):
        return True
    live = _make_callback()
    original = keras.Model.fit

    def fit(self, *args, **kwargs):
        if len(args) < 6:  # callbacks not passed positionally
            callbacks = list(kwargs.get("callbacks") or [])
            if not any(isinstance(c, live) for c in callbacks):
                callbacks.append(live())
            kwargs["callbacks"] = callbacks
            if len(args) < 5:
                kwargs.setdefault("verbose", 2)  # one line per epoch, not a progress bar
        return original(self, *args, **kwargs)

    fit._mle = True  # type: ignore[attr-defined]
    fit.__doc__ = original.__doc__
    keras.Model.fit = fit
    return True


def install(warm: bool = True) -> None:
    """Called once when the kernel starts."""
    try:
        import matplotlib

        matplotlib.rcParams.update({
            "figure.facecolor": "black", "axes.facecolor": "black", "savefig.facecolor": "black",
            "text.color": "white", "axes.labelcolor": "white", "axes.edgecolor": "#666",
            "xtick.color": "#aaa", "ytick.color": "#aaa", "grid.color": "#333",
            "axes.prop_cycle": matplotlib.cycler(color=["#ffffff", "#7CFFB2", "#FF5C7A", "#8ab4ff", "#ffd166"]),
            "figure.dpi": 110,
        })
    except Exception:
        pass
    if warm:
        try:
            _patch_keras()
        except Exception:
            pass

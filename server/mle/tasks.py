"""Checks for Lab lessons.

After your code runs, the Lab sends a small check for the current step. It runs here,
next to your variables, and reports whether the step is done and what to fix if not.
The check sees a copy of your variables, so it cannot change them.
"""
from __future__ import annotations

import json
from typing import Any

MARK = "<<mle-check>>"


def _fitted(value: Any) -> bool:
    return any(k.endswith("_") and not k.startswith("_") for k in getattr(value, "__dict__", {}))


def check(body: str, code: str) -> dict[str, Any]:
    """Run one step's check against the kernel's variables and print the result for the engine."""
    import __main__

    env: dict[str, Any] = dict(vars(__main__))
    flat = "".join(code.split())   # the code with all spaces removed, for simple "did you write X" tests

    def need(name: str) -> Any:
        if name not in env:
            raise AssertionError(f"I can't find a variable called {name}. Create it, then press Run & check again.")
        return env[name]

    def wrote(*fragments: str) -> bool:
        """True if the code contains every fragment (spaces ignored)."""
        return all("".join(f.split()) in flat for f in fragments)

    def instances(type_name: str, fitted: bool = False) -> list[Any]:
        """Every variable whose type has this name, e.g. instances("SVC")."""
        found = [v for k, v in env.items() if not k.startswith("_") and type(v).__name__ == type_name]
        return [v for v in found if _fitted(v)] if fitted else found

    def dense(model: Any) -> list[Any]:
        return [layer for layer in getattr(model, "layers", []) if type(layer).__name__ == "Dense"]

    env.update(need=need, wrote=wrote, instances=instances, dense=dense, code=code, praise=None)
    try:
        exec(compile(body, "<check>", "exec"), env)
        result = {"ok": True, "message": env.get("praise") or "Step complete."}
    except AssertionError as exc:
        result = {"ok": False, "message": str(exc) or "Not quite yet. Re-read the task and try again."}
    except NameError as exc:
        result = {"ok": False, "message": f"Something this step needs does not exist yet ({exc}). Write it, then press Run & check."}
    except Exception as exc:  # the user's objects can be in any state
        result = {"ok": False, "message": f"Not quite yet: checking your code raised {type(exc).__name__}: {exc}"}
    print(MARK + json.dumps(result))
    return result

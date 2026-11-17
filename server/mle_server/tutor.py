"""Answers questions about the Lab with Claude. Optional: it needs your own Anthropic credentials.

Credentials are read the usual way (ANTHROPIC_API_KEY, or a profile from `ant auth login`), or from a
private `.env` file at the project root (gitignored) with a line `ANTHROPIC_API_KEY=...`.
ML-E never sends the key anywhere but Anthropic; it stays in the engine's environment.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

MODEL = "claude-opus-5-5"
MAX_CODE_CHARS = 30_000

SYSTEM = """You are the tutor inside ML-E, an app where a learner practises machine learning in Python \
(Keras on PyTorch, scikit-learn, pandas, PyTorch). They learn best visually and lose focus with long text.

How to answer:
- Answer the question first, in plain words, in at most about 150 words.
- Use one tiny example or analogy when it helps. Short code snippets are fine for explaining an idea.
- When the question is about the lesson step they are working on, teach the idea and give a hint toward \
the next move. Do not write the finished code for that step unless they clearly ask for the answer.
- If they paste an error, say what it means and where in their code to look.
- Use Markdown sparingly: `inline code`, fenced code blocks and short lists only. No headings, no tables.
- If the code or lesson context does not matter to the question, ignore it."""


class TutorError(Exception):
    """A problem the learner can act on; the message is shown as-is."""


ENV_FILES = [Path(__file__).resolve().parents[2] / ".env", Path(__file__).resolve().parents[1] / ".env"]


def load_env_file(paths: list[Path] | None = None) -> None:
    """Copy ANTHROPIC_* settings from a local .env into the environment. Real env vars win."""
    for path in ENV_FILES if paths is None else paths:
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line.startswith("export "):
                line = line[7:].strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = (part.strip() for part in line.split("=", 1))
            value = value.strip("'\"")
            if name.startswith("ANTHROPIC_") and value and not os.environ.get(name):
                os.environ[name] = value


def available() -> bool:
    """Best guess at whether credentials are set up, without calling the API."""
    load_env_file()
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    return (Path.home() / ".config" / "anthropic").is_dir()


def _client() -> Any:
    import anthropic

    load_env_file()
    return anthropic.Anthropic()


def ask(question: str, code: str = "", context: str = "", error: str = "", history: list[dict[str, str]] | None = None) -> str:
    import anthropic

    question = question.strip()
    if not question:
        raise TutorError("type a question first")
    messages: list[dict[str, Any]] = []
    for turn in (history or [])[-4:]:
        if turn.get("q") and turn.get("a"):
            messages += [{"role": "user", "content": turn["q"][:2000]}, {"role": "assistant", "content": turn["a"][:4000]}]
    parts = []
    if context:
        parts.append(f"<lesson_step>\n{context[:3000]}\n</lesson_step>")
    if code.strip():
        parts.append(f"<their_code>\n{code[:MAX_CODE_CHARS]}\n</their_code>")
    if error.strip():
        parts.append(f"<last_error>\n{error[-3000:]}\n</last_error>")
    parts.append(f"Question: {question[:2000]}")
    messages.append({"role": "user", "content": "\n\n".join(parts)})

    try:
        response = _client().beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",          # if this model declines, the API retries on a suitable fallback
            output_config={"effort": "low"},
            system=SYSTEM,
            messages=messages,
        )
    except anthropic.AuthenticationError:
        raise TutorError("Anthropic rejected the API key. Check ANTHROPIC_API_KEY in your .env file.")
    except anthropic.PermissionDeniedError:
        raise TutorError("this API key is not allowed to use the model.")
    except anthropic.RateLimitError:
        raise TutorError("too many questions at once. Wait a minute and ask again.")
    except anthropic.APIStatusError as exc:
        raise TutorError(f"Anthropic returned an error ({exc.status_code}). Try again shortly.")
    except anthropic.APIConnectionError:
        raise TutorError("could not reach Anthropic. Check your internet connection.")
    except anthropic.AnthropicError as exc:   # e.g. no credentials found at all
        raise TutorError(f"AI answers are not set up: {exc}")

    if response.stop_reason == "refusal":
        raise TutorError("the AI declined to answer that question.")
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if not text:
        raise TutorError("the AI returned an empty answer. Try rephrasing the question.")
    return text

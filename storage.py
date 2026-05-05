import json
from pathlib import Path

_DATA_DIR = Path("data")
_DATA_DIR.mkdir(exist_ok=True)


def load_following(username: str) -> dict[str, dict]:
    """Returns stored following list as {user_id: {id, username, name}}."""
    path = _DATA_DIR / f"{username}.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def save_following(username: str, following: dict[str, dict]) -> None:
    path = _DATA_DIR / f"{username}.json"
    path.write_text(json.dumps(following, indent=2))


def load_meta(username: str) -> dict:
    """Returns stored metadata as {user_id, following_count}, or {} if not found."""
    path = _DATA_DIR / f"{username}.meta.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def save_meta(username: str, meta: dict) -> None:
    path = _DATA_DIR / f"{username}.meta.json"
    path.write_text(json.dumps(meta))


def load_convergence() -> dict:
    """Returns convergence index as {user_id: {username, name, followed_by: {tracker: iso_ts}}}."""
    path = _DATA_DIR / "convergence.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def save_convergence(data: dict) -> None:
    path = _DATA_DIR / "convergence.json"
    path.write_text(json.dumps(data, indent=2))


def append_feed(entry: dict) -> None:
    path = _DATA_DIR / "feed.jsonl"
    with path.open("a") as f:
        f.write(json.dumps(entry) + "\n")


def load_feed() -> list[dict]:
    path = _DATA_DIR / "feed.jsonl"
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

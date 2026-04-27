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

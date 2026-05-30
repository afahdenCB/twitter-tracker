import json
import os

from google.cloud import storage as gcs

_BUCKET_NAME = os.environ["GCS_BUCKET"]
_client = gcs.Client()
_bucket = _client.bucket(_BUCKET_NAME)


def _read_json(blob_name: str, default):
    blob = _bucket.blob(blob_name)
    if not blob.exists():
        return default
    return json.loads(blob.download_as_text())


def _write_json(blob_name: str, data, indent=None) -> None:
    _bucket.blob(blob_name).upload_from_string(
        json.dumps(data, indent=indent),
        content_type="application/json",
    )


def load_following(username: str) -> dict[str, dict]:
    return _read_json(f"{username}.json", {})


def save_following(username: str, following: dict[str, dict]) -> None:
    _write_json(f"{username}.json", following, indent=2)


def load_meta(username: str) -> dict:
    return _read_json(f"{username}.meta.json", {})


def save_meta(username: str, meta: dict) -> None:
    _write_json(f"{username}.meta.json", meta)


def load_convergence() -> dict:
    return _read_json("convergence.json", {})


def save_convergence(data: dict) -> None:
    _write_json("convergence.json", data, indent=2)


def append_feed(entry: dict) -> None:
    blob = _bucket.blob("feed.jsonl")
    existing = blob.download_as_text() if blob.exists() else ""
    blob.upload_from_string(
        existing + json.dumps(entry) + "\n",
        content_type="application/x-ndjson",
    )


def load_feed() -> list[dict]:
    blob = _bucket.blob("feed.jsonl")
    if not blob.exists():
        return []
    return [json.loads(line) for line in blob.download_as_text().splitlines() if line.strip()]


def load_status() -> dict:
    return _read_json("status.json", {})


def save_status(data: dict) -> None:
    _write_json("status.json", data)


def load_tracked_accounts() -> list[str]:
    return _read_json("accounts.json", [])


def save_tracked_accounts(accounts: list[str]) -> None:
    _write_json("accounts.json", accounts)


def load_tags() -> dict:
    return _read_json("tags.json", {"tags": [], "account_tags": {}})


def save_tags(data: dict) -> None:
    _write_json("tags.json", data, indent=2)

"""RecLLM Python — Settings Manager (encrypted API key storage)"""

import json
import base64
import hashlib
import os
from pathlib import Path

from app.config import APP_DATA_DIR, ensure_dirs
from app.database.db import get_cursor


# Simple obfuscation for API keys at rest (not true encryption, but prevents casual reading)
_SALT = b"recllm-2025-salt"


def _derive_key() -> bytes:
    """Derive a machine-specific key for obfuscation."""
    machine_id = os.environ.get("COMPUTERNAME", os.environ.get("HOSTNAME", "recllm-default"))
    return hashlib.pbkdf2_hmac("sha256", machine_id.encode(), _SALT, 100_000)


def _obfuscate(plaintext: str) -> str:
    """Obfuscate a string (XOR with derived key, base64 encoded)."""
    key = _derive_key()
    data = plaintext.encode()
    obfuscated = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
    return base64.b64encode(obfuscated).decode()


def _deobfuscate(encoded: str) -> str:
    """Reverse obfuscation."""
    key = _derive_key()
    data = base64.b64decode(encoded)
    plaintext = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
    return plaintext.decode()


def save_api_key(provider: str, key: str):
    """Save an API key (obfuscated)."""
    with get_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key = ?", ("api_keys",))
        row = cur.fetchone()
        existing = {}
        if row:
            try:
                existing = json.loads(row["value"])
            except (json.JSONDecodeError, TypeError):
                pass

        existing[provider] = _obfuscate(key) if key else ""
        cur.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            ("api_keys", json.dumps(existing)),
        )


def get_api_key(provider: str) -> str | None:
    """Retrieve a decrypted API key."""
    with get_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key = ?", ("api_keys",))
        row = cur.fetchone()
        if not row:
            return None
        try:
            keys = json.loads(row["value"])
            encoded = keys.get(provider)
            if not encoded:
                return None
            return _deobfuscate(encoded)
        except (json.JSONDecodeError, TypeError, Exception):
            return None


def get_all_api_key_status() -> dict[str, bool]:
    """Check which API keys are configured."""
    with get_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key = ?", ("api_keys",))
        row = cur.fetchone()
        if not row:
            return {"assemblyai": False, "gemini": False, "openai": False}
        try:
            keys = json.loads(row["value"])
            return {
                "assemblyai": bool(keys.get("assemblyai")),
                "gemini": bool(keys.get("gemini")),
                "openai": bool(keys.get("openai")),
            }
        except (json.JSONDecodeError, TypeError):
            return {"assemblyai": False, "gemini": False, "openai": False}


def save_preference(key: str, value):
    """Save a user preference."""
    with get_cursor() as cur:
        cur.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (f"pref.{key}", json.dumps(value)),
        )


def get_preference(key: str, default=None):
    """Get a user preference."""
    with get_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key = ?", (f"pref.{key}",))
        row = cur.fetchone()
        if not row:
            return default
        try:
            return json.loads(row["value"])
        except (json.JSONDecodeError, TypeError):
            return default


def get_all_preferences() -> dict:
    """Get all user preferences."""
    with get_cursor() as cur:
        cur.execute("SELECT key, value FROM settings WHERE key LIKE 'pref.%'")
        rows = cur.fetchall()

    prefs = {}
    for row in rows:
        pref_key = row["key"][5:]  # Remove "pref." prefix
        try:
            prefs[pref_key] = json.loads(row["value"])
        except (json.JSONDecodeError, TypeError):
            prefs[pref_key] = row["value"]
    return prefs

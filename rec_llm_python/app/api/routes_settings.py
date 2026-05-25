"""RecLLM Python Core — Settings API Routes"""

import json
from fastapi import APIRouter
from pydantic import BaseModel

from app.database.db import get_cursor

router = APIRouter()


class SettingUpdate(BaseModel):
    key: str
    value: str


@router.get("/")
async def get_all_settings():
    """Get all settings."""
    with get_cursor() as cur:
        cur.execute("SELECT key, value FROM settings")
        rows = cur.fetchall()

    settings = {}
    for row in rows:
        try:
            settings[row["key"]] = json.loads(row["value"])
        except (json.JSONDecodeError, TypeError):
            settings[row["key"]] = row["value"]

    return settings


@router.get("/{key}")
async def get_setting(key: str):
    """Get a single setting."""
    with get_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cur.fetchone()

    if not row:
        return {"key": key, "value": None}

    try:
        value = json.loads(row["value"])
    except (json.JSONDecodeError, TypeError):
        value = row["value"]

    return {"key": key, "value": value}


@router.put("/")
async def set_setting(update: SettingUpdate):
    """Set a setting value."""
    with get_cursor() as cur:
        cur.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (update.key, update.value),
        )
    return {"ok": True}


@router.delete("/{key}")
async def delete_setting(key: str):
    """Delete a setting."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM settings WHERE key = ?", (key,))
    return {"ok": True}


@router.post("/api-keys")
async def save_api_keys(keys: dict):
    """Save API keys (stored as JSON)."""
    with get_cursor() as cur:
        cur.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            ("api_keys", json.dumps(keys)),
        )
    return {"ok": True}


@router.get("/api-keys/status")
async def check_api_keys():
    """Check which API keys are configured."""
    with get_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key = ?", ("api_keys",))
        row = cur.fetchone()

    if not row:
        return {"assemblyai": False, "gemini": False, "openai": False}

    try:
        keys = json.loads(row["value"])
    except (json.JSONDecodeError, TypeError):
        return {"assemblyai": False, "gemini": False, "openai": False}

    return {
        "assemblyai": bool(keys.get("assemblyai")),
        "gemini": bool(keys.get("gemini")),
        "openai": bool(keys.get("openai")),
    }

"""RecLLM Python Core — Gemini AI Client"""

import httpx
import json
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiClient:
    """Async client for Google Gemini API."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model = model
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=30.0),
        )

    async def close(self):
        await self._client.aclose()

    async def generate(self, prompt: str, system_instruction: str = "") -> str:
        """Generate text from a prompt."""
        url = f"{GEMINI_BASE_URL}/models/{self.model}:generateContent?key={self.api_key}"

        payload: dict = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 8192,
            },
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        resp = await self._client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

        # Extract text from response
        candidates = data.get("candidates", [])
        if not candidates:
            raise RuntimeError("No response from Gemini")

        parts = candidates[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts)

    async def generate_json(self, prompt: str, system_instruction: str = "") -> dict:
        """Generate and parse JSON response."""
        text = await self.generate(prompt, system_instruction)
        # Try to extract JSON from response
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text.strip())

    async def check_connection(self) -> bool:
        """Verify API key is valid."""
        try:
            url = f"{GEMINI_BASE_URL}/models?key={self.api_key}"
            resp = await self._client.get(url)
            return resp.status_code == 200
        except Exception:
            return False

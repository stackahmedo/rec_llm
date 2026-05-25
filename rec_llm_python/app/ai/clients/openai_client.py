"""RecLLM Python Core — OpenAI-compatible AI Client"""

import httpx
import json
import logging

logger = logging.getLogger(__name__)


class OpenAIClient:
    """Async client for OpenAI (or compatible) API."""

    def __init__(self, api_key: str, model: str = "gpt-4o", base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=httpx.Timeout(120.0, connect=30.0),
        )

    async def close(self):
        await self._client.aclose()

    async def generate(self, prompt: str, system_instruction: str = "") -> str:
        """Generate text from a prompt."""
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        resp = await self._client.post(
            f"{self.base_url}/chat/completions",
            json={
                "model": self.model,
                "messages": messages,
                "temperature": 0.3,
                "max_tokens": 8192,
            },
        )
        resp.raise_for_status()
        data = resp.json()

        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("No response from OpenAI")

        return choices[0].get("message", {}).get("content", "")

    async def generate_json(self, prompt: str, system_instruction: str = "") -> dict:
        """Generate and parse JSON response."""
        text = await self.generate(prompt, system_instruction)
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
            resp = await self._client.get(f"{self.base_url}/models")
            return resp.status_code == 200
        except Exception:
            return False

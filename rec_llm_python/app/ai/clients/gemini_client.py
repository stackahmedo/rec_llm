"""RecLLM Python — Gemini Client (Google AI)"""

import logging
import httpx

logger = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODEL = "gemini-1.5-flash"


class GeminiClient:
    """Async Gemini API client for summarization, grammar, and translation."""

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self.api_key = api_key
        self.model = model
        self._client = httpx.AsyncClient(timeout=120.0)

    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        """Generate text using Gemini API."""
        url = f"{GEMINI_API_URL}/{self.model}:generateContent?key={self.api_key}"

        contents = []
        if system_prompt:
            contents.append({
                "role": "user",
                "parts": [{"text": f"System instruction: {system_prompt}"}],
            })
            contents.append({
                "role": "model",
                "parts": [{"text": "Understood. I will follow these instructions."}],
            })

        contents.append({
            "role": "user",
            "parts": [{"text": prompt}],
        })

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 4096,
            },
        }

        try:
            response = await self._client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError("No response from Gemini")

            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts:
                raise RuntimeError("Empty response from Gemini")

            return parts[0].get("text", "").strip()

        except httpx.HTTPStatusError as e:
            logger.error("Gemini API error %d: %s", e.response.status_code, e.response.text[:200])
            raise RuntimeError(f"Gemini API error: {e.response.status_code}") from e
        except Exception as e:
            logger.error("Gemini request failed: %s", e)
            raise

    async def generate_structured(self, prompt: str, system_prompt: str = "") -> str:
        """Generate with JSON output instruction."""
        json_prompt = f"{prompt}\n\nRespond with valid JSON only, no markdown formatting."
        return await self.generate(json_prompt, system_prompt)

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()

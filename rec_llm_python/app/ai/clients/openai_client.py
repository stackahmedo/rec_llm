"""RecLLM Python — OpenAI Client (GPT-4o / GPT-4o-mini)"""

import logging
import httpx

logger = logging.getLogger(__name__)

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"


class OpenAIClient:
    """Async OpenAI API client for summarization, grammar, and translation."""

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self.api_key = api_key
        self.model = model
        self._client = httpx.AsyncClient(
            timeout=120.0,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        """Generate text using OpenAI Chat Completions API."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 4096,
        }

        try:
            response = await self._client.post(OPENAI_API_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except httpx.HTTPStatusError as e:
            logger.error("OpenAI API error %d: %s", e.response.status_code, e.response.text[:200])
            raise RuntimeError(f"OpenAI API error: {e.response.status_code}") from e
        except Exception as e:
            logger.error("OpenAI request failed: %s", e)
            raise

    async def generate_structured(self, prompt: str, system_prompt: str = "") -> str:
        """Generate with JSON mode enabled."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 4096,
            "response_format": {"type": "json_object"},
        }

        try:
            response = await self._client.post(OPENAI_API_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except httpx.HTTPStatusError as e:
            logger.error("OpenAI API error %d: %s", e.response.status_code, e.response.text[:200])
            raise RuntimeError(f"OpenAI API error: {e.response.status_code}") from e
        except Exception as e:
            logger.error("OpenAI request failed: %s", e)
            raise

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()

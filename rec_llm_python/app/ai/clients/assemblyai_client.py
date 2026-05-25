"""RecLLM Python — AssemblyAI Client (Transcription)"""

import logging
import time
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

ASSEMBLYAI_API_URL = "https://api.assemblyai.com/v2"


@dataclass
class Utterance:
    speaker: str
    text: str
    start_ms: int
    end_ms: int
    confidence: float = 1.0


@dataclass
class TranscriptionResult:
    ok: bool
    text: str = ""
    full_text: str = ""
    utterances: list = None
    error: str = ""
    duration_ms: int = 0
    language_code: str = ""
    speaker_count: int = 0

    def __post_init__(self):
        if self.utterances is None:
            self.utterances = []
        # Sync text and full_text
        if self.full_text and not self.text:
            self.text = self.full_text
        elif self.text and not self.full_text:
            self.full_text = self.text


class AssemblyAIClient:
    """Async AssemblyAI client for audio transcription."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._client = httpx.AsyncClient(
            timeout=300.0,
            headers={
                "Authorization": api_key,
                "Content-Type": "application/json",
            },
        )

    async def upload_file(self, file_path: str) -> str:
        """Upload an audio file and return the upload URL."""
        headers = {"Authorization": self.api_key}

        async with httpx.AsyncClient(timeout=600.0) as client:
            with open(file_path, "rb") as f:
                response = await client.post(
                    f"{ASSEMBLYAI_API_URL}/upload",
                    headers=headers,
                    content=f.read(),
                )
                response.raise_for_status()
                return response.json()["upload_url"]

    async def transcribe(
        self,
        audio_url: str,
        language_code: str = "auto",
        speaker_labels: bool = True,
        speakers_expected: int = 0,
    ) -> TranscriptionResult:
        """Submit transcription and poll until complete."""
        # Submit
        payload = {
            "audio_url": audio_url,
            "speaker_labels": speaker_labels,
        }

        if language_code and language_code != "auto":
            payload["language_code"] = language_code
        else:
            payload["language_detection"] = True

        if speakers_expected > 0:
            payload["speakers_expected"] = speakers_expected

        try:
            response = await self._client.post(
                f"{ASSEMBLYAI_API_URL}/transcript",
                json=payload,
            )
            response.raise_for_status()
            transcript_id = response.json()["id"]
        except httpx.HTTPStatusError as e:
            return TranscriptionResult(ok=False, error=f"Submit failed: {e.response.status_code}")
        except Exception as e:
            return TranscriptionResult(ok=False, error=f"Submit failed: {str(e)}")

        # Poll
        poll_url = f"{ASSEMBLYAI_API_URL}/transcript/{transcript_id}"
        max_polls = 600  # 10 minutes max
        poll_interval = 3.0

        for _ in range(max_polls):
            try:
                response = await self._client.get(poll_url)
                response.raise_for_status()
                data = response.json()

                status = data.get("status")
                if status == "completed":
                    return self._parse_result(data)
                elif status == "error":
                    return TranscriptionResult(ok=False, error=data.get("error", "Unknown error"))

                # Still processing
                import asyncio
                await asyncio.sleep(poll_interval)

            except Exception as e:
                logger.warning("Poll error (retrying): %s", e)
                import asyncio
                await asyncio.sleep(poll_interval)

        return TranscriptionResult(ok=False, error="Transcription timed out")

    async def transcribe_file(
        self,
        file_path: str,
        language_code: str = "auto",
        speaker_labels: bool = True,
        speakers_expected: int = 0,
    ) -> TranscriptionResult:
        """Upload and transcribe a file in one call."""
        logger.info("Uploading file: %s", file_path)
        upload_url = await self.upload_file(file_path)

        logger.info("Transcribing: %s", upload_url[:50])
        return await self.transcribe(
            audio_url=upload_url,
            language_code=language_code,
            speaker_labels=speaker_labels,
            speakers_expected=speakers_expected,
        )

    def _parse_result(self, data: dict) -> TranscriptionResult:
        """Parse AssemblyAI response into our format."""
        utterances = []
        for u in data.get("utterances", []):
            utterances.append({
                "speaker": u.get("speaker", "Speaker"),
                "text": u.get("text", ""),
                "start_ms": u.get("start", 0),
                "end_ms": u.get("end", 0),
                "confidence": u.get("confidence", 1.0),
                "words": u.get("words", []),
            })

        # Count unique speakers
        speakers = set(u["speaker"] for u in utterances)

        return TranscriptionResult(
            ok=True,
            text=data.get("text", ""),
            utterances=utterances,
            duration_ms=data.get("audio_duration", 0) * 1000,
            language_code=data.get("language_code", ""),
            speaker_count=len(speakers),
        )

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()

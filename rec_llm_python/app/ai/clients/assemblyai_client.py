"""RecLLM Python Core — AssemblyAI Transcription Client"""

import httpx
import asyncio
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2"


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
    full_text: str = ""
    utterances: list[Utterance] | None = None
    language_code: str = "auto"
    error: str | None = None


class AssemblyAIClient:
    """Async client for AssemblyAI transcription API."""

    def __init__(self, api_key: str, model: str = "best"):
        self.api_key = api_key
        self.model = model
        self._client = httpx.AsyncClient(
            base_url=ASSEMBLYAI_BASE_URL,
            headers={"Authorization": self.api_key},
            timeout=httpx.Timeout(300.0, connect=30.0),
        )

    async def close(self):
        await self._client.aclose()

    async def upload_file(self, file_path: str) -> str:
        """Upload audio file and return upload URL."""
        logger.info("Uploading %s to AssemblyAI...", file_path)
        with open(file_path, "rb") as f:
            resp = await self._client.post(
                "/upload",
                content=f.read(),
                headers={"Content-Type": "application/octet-stream"},
            )
        resp.raise_for_status()
        upload_url = resp.json()["upload_url"]
        logger.info("Upload complete: %s", upload_url[:60])
        return upload_url

    async def transcribe(
        self,
        audio_url: str,
        speaker_labels: bool = True,
        language_code: str | None = None,
    ) -> TranscriptionResult:
        """Submit transcription job and poll until complete."""
        # Submit
        payload: dict = {
            "audio_url": audio_url,
            "speaker_labels": speaker_labels,
        }
        if self.model == "nano":
            payload["speech_model"] = "nano"
        if language_code and language_code != "auto":
            payload["language_code"] = language_code
        else:
            payload["language_detection"] = True

        resp = await self._client.post("/transcript", json=payload)
        resp.raise_for_status()
        transcript_id = resp.json()["id"]
        logger.info("Transcription submitted: %s", transcript_id)

        # Poll
        while True:
            await asyncio.sleep(3.0)
            resp = await self._client.get(f"/transcript/{transcript_id}")
            resp.raise_for_status()
            data = resp.json()
            status = data.get("status")

            if status == "completed":
                return self._parse_result(data)
            elif status == "error":
                return TranscriptionResult(
                    ok=False,
                    error=data.get("error", "Transcription failed"),
                )
            # else: queued or processing — continue polling

    async def transcribe_file(
        self,
        file_path: str,
        speaker_labels: bool = True,
        language_code: str | None = None,
    ) -> TranscriptionResult:
        """Upload and transcribe a local file."""
        upload_url = await self.upload_file(file_path)
        return await self.transcribe(upload_url, speaker_labels, language_code)

    def _parse_result(self, data: dict) -> TranscriptionResult:
        """Parse AssemblyAI response into our data model."""
        utterances: list[Utterance] = []

        # Use utterances (speaker-labeled segments) if available
        if data.get("utterances"):
            for u in data["utterances"]:
                utterances.append(Utterance(
                    speaker=u.get("speaker", "Speaker"),
                    text=u.get("text", ""),
                    start_ms=u.get("start", 0),
                    end_ms=u.get("end", 0),
                    confidence=u.get("confidence", 1.0),
                ))
        elif data.get("words"):
            # Fallback: group words into sentences
            current_text = []
            current_start = 0
            for w in data["words"]:
                if not current_text:
                    current_start = w.get("start", 0)
                current_text.append(w.get("text", ""))
                # Split on sentence boundaries
                if w.get("text", "").rstrip().endswith((".", "!", "?", "。", "！", "？")):
                    utterances.append(Utterance(
                        speaker="Speaker A",
                        text=" ".join(current_text),
                        start_ms=current_start,
                        end_ms=w.get("end", 0),
                        confidence=w.get("confidence", 1.0),
                    ))
                    current_text = []
            if current_text:
                utterances.append(Utterance(
                    speaker="Speaker A",
                    text=" ".join(current_text),
                    start_ms=current_start,
                    end_ms=data["words"][-1].get("end", 0),
                ))

        return TranscriptionResult(
            ok=True,
            full_text=data.get("text", ""),
            utterances=utterances,
            language_code=data.get("language_code", "auto"),
        )

    async def check_connection(self) -> bool:
        """Verify API key is valid."""
        try:
            resp = await self._client.get("/transcript", params={"limit": 1})
            return resp.status_code == 200
        except Exception:
            return False

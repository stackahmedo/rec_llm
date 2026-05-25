"""RecLLM Python — Exports API Routes"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import EXPORTS_DIR, ensure_dirs
from app.database.db import get_cursor
from app.exports.txt_exporter import export_transcript_txt
from app.exports.pdf_exporter import export_transcript_pdf, PdfExportOptions

router = APIRouter()


class ExportRequest(BaseModel):
    recording_id: str
    export_type: str = "txt"  # txt | pdf | docx
    include_metadata: bool = True
    include_summary: bool = True
    include_timestamps: bool = True
    language: str = "ja"


@router.post("/")
async def create_export(req: ExportRequest):
    """Export a transcript to PDF, TXT, or DOCX."""
    ensure_dirs()

    # Verify recording exists
    with get_cursor() as cur:
        cur.execute("SELECT id, original_file_name FROM recordings WHERE id = ?", (req.recording_id,))
        recording = cur.fetchone()
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")

    base_name = Path(recording["original_file_name"]).stem
    output_dir = EXPORTS_DIR / req.recording_id

    try:
        if req.export_type == "txt":
            output_path = output_dir / f"{base_name}_transcript.txt"
            result_path = export_transcript_txt(req.recording_id, output_path, req.include_metadata)

        elif req.export_type == "pdf":
            output_path = output_dir / f"{base_name}_report.pdf"
            options = PdfExportOptions(
                include_metadata=req.include_metadata,
                include_summary=req.include_summary,
                include_transcript=True,
                include_timestamps=req.include_timestamps,
                language=req.language,
            )
            result_path = export_transcript_pdf(req.recording_id, output_path, options)

        elif req.export_type == "docx":
            output_path = output_dir / f"{base_name}_transcript.docx"
            from app.exports.docx_exporter import export_transcript_docx
            result_path = export_transcript_docx(
                req.recording_id, output_path, req.include_metadata, req.language
            )

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported export type: {req.export_type}")

        return {
            "ok": True,
            "filePath": result_path,
            "exportType": req.export_type,
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/history")
async def export_history(recording_id: str | None = None, limit: int = 50):
    """Get export history."""
    with get_cursor() as cur:
        if recording_id:
            cur.execute(
                "SELECT * FROM exports WHERE recording_id = ? ORDER BY created_at DESC LIMIT ?",
                (recording_id, limit),
            )
        else:
            cur.execute(
                "SELECT * FROM exports ORDER BY created_at DESC LIMIT ?",
                (limit,),
            )
        rows = cur.fetchall()

    return {"exports": [dict(r) for r in rows]}

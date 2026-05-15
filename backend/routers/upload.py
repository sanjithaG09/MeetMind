import os
from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Form
from typing import Optional
from database import get_supabase
from models.schemas import UploadResponse
from services.processor import process_meeting, append_to_meeting

router = APIRouter()

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".mp4", ".m4a", ".webm"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB


@router.post("/upload", response_model=UploadResponse)
async def upload_meeting(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 25MB limit.")

    supabase = get_supabase()

    # Generate ID first so storage path is always unique
    meeting_id = str(uuid4())
    storage_path = f"meetings/{meeting_id}{ext}"

    supabase.storage.from_("meeting-files").upload(
        storage_path,
        content,
        {"content-type": file.content_type or "application/octet-stream"},
    )
    file_url = supabase.storage.from_("meeting-files").get_public_url(storage_path)

    # Create meeting record with the pre-generated ID
    meeting_title = title or os.path.splitext(file.filename or "Meeting")[0]
    supabase.table("meetings").insert(
        {
            "id": meeting_id,
            "title": meeting_title,
            "file_url": file_url,
            "file_name": file.filename,
            "status": "processing",
        }
    ).execute()

    background_tasks.add_task(
        process_meeting, meeting_id, content, file.filename or f"audio{ext}"
    )

    return UploadResponse(meeting_id=meeting_id, status="processing")


@router.post("/meetings/{meeting_id}/append", response_model=UploadResponse)
async def append_meeting_audio(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 500MB limit.")

    background_tasks.add_task(
        append_to_meeting, meeting_id, content, file.filename or f"audio{ext}"
    )

    return UploadResponse(meeting_id=meeting_id, status="processing")

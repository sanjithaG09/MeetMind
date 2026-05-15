from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class Segment(BaseModel):
    start: float
    end: float
    text: str


class TranscriptData(BaseModel):
    full_text: str
    language: Optional[str] = None
    segments: list[Segment] = []


class Topic(BaseModel):
    id: str
    title: str
    summary: Optional[str] = None
    status: str  # resolved | pending
    decision: Optional[str] = None
    reason: Optional[str] = None
    stopped_at: Optional[str] = None
    blocker: Optional[str] = None
    next_step: Optional[str] = None
    position: int = 0
    recording_index: int = 0


class ActionItem(BaseModel):
    id: str
    assignee: str
    task: str
    priority: Optional[str] = None  # high | medium | low
    deadline: Optional[str] = None
    status: str = "pending"  # pending | completed
    topic_title: Optional[str] = None
    recording_index: int = 0


class MeetingIntelligence(BaseModel):
    summary: Optional[str] = None
    key_decisions: list[str] = []
    unresolved_count: int = 0
    total_topics: int = 0


class AudioFile(BaseModel):
    url: str
    file_name: str
    uploaded_at: Optional[str] = None


class MeetingListItem(BaseModel):
    id: str
    title: str
    status: str
    processing_step: Optional[str] = None
    created_at: str
    duration_seconds: Optional[int] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    extra_audio_files: list[AudioFile] = []
    total_topics: int = 0
    resolved_count: int = 0
    pending_count: int = 0
    action_items_count: int = 0
    error_message: Optional[str] = None


class MeetingDetail(MeetingListItem):
    transcript: Optional[TranscriptData] = None
    intelligence: Optional[MeetingIntelligence] = None
    topics: list[Topic] = []
    action_items: list[ActionItem] = []


class UploadResponse(BaseModel):
    meeting_id: str
    status: str


class ActionItemStatusUpdate(BaseModel):
    status: str  # pending | completed

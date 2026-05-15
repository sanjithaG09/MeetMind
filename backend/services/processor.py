import logging
import os
import time
import traceback
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from database import get_supabase
from services.transcription import transcribe_audio
from services.analysis import analyze_transcript
from ws_manager import manager


# ── Helpers ────────────────────────────────────────────────────────────────────

def _set_step(supabase, meeting_id: str, step: str | None) -> None:
    try:
        supabase.table("meetings").update({"processing_step": step}).eq("id", meeting_id).execute()
    except Exception:
        pass  # column may not exist yet — run the migration SQL


def _get_completed_tasks(supabase, meeting_id: str) -> set[str]:
    """Return the set of task texts currently marked completed."""
    result = (
        supabase.table("action_items")
        .select("task")
        .eq("meeting_id", meeting_id)
        .eq("status", "completed")
        .execute()
    )
    return {row["task"] for row in (result.data or [])}


def _clear_analysis(supabase, meeting_id: str) -> None:
    supabase.table("topics").delete().eq("meeting_id", meeting_id).execute()
    supabase.table("action_items").delete().eq("meeting_id", meeting_id).execute()
    supabase.table("meeting_intelligence").delete().eq("meeting_id", meeting_id).execute()


def _store_analysis(
    supabase,
    meeting_id: str,
    analysis: dict,
    completed_tasks: set[str] | None = None,
    recording_index: int = 0,
    include_intelligence: bool = True,
) -> None:
    topic_id_map: dict[str, str] = {}
    for topic in analysis.get("topics", []):
        result = (
            supabase.table("topics")
            .insert(
                {
                    "meeting_id": meeting_id,
                    "title": topic["title"],
                    "summary": topic.get("summary"),
                    "status": topic.get("status", "pending"),
                    "decision": topic.get("decision"),
                    "reason": topic.get("reason"),
                    "stopped_at": topic.get("stopped_at"),
                    "blocker": topic.get("blocker"),
                    "next_step": topic.get("next_step"),
                    "position": topic.get("position", 0),
                    "recording_index": recording_index,
                }
            )
            .execute()
        )
        topic_id_map[topic["title"]] = result.data[0]["id"]

    def _resolve_topic_id(title: str | None) -> str | None:
        if not title:
            return None
        if title in topic_id_map:
            return topic_id_map[title]
        # Fuzzy fallback: case-insensitive strip match
        lower = title.strip().lower()
        for key, tid in topic_id_map.items():
            if key.strip().lower() == lower:
                return tid
        return None

    for item in analysis.get("action_items", []):
        if not item.get("task"):
            continue
        topic_id = _resolve_topic_id(item.get("topic_title"))
        status = "completed" if completed_tasks and item["task"] in completed_tasks else "pending"
        supabase.table("action_items").insert(
            {
                "meeting_id": meeting_id,
                "topic_id": topic_id,
                "assignee": item.get("assignee") or "Unassigned",
                "task": item["task"],
                "priority": item.get("priority", "medium"),
                "deadline": item.get("deadline"),
                "status": status,
                "recording_index": recording_index,
            }
        ).execute()

    if include_intelligence:
        supabase.table("meeting_intelligence").insert(
            {
                "meeting_id": meeting_id,
                "summary": analysis.get("summary"),
                "key_decisions": analysis.get("key_decisions", []),
                "unresolved_count": analysis.get("unresolved_count", 0),
                "total_topics": analysis.get("total_topics", 0),
            }
        ).execute()


async def reanalyze_meeting(meeting_id: str) -> None:
    """Re-run AI analysis on the existing transcript without re-transcribing."""
    supabase = get_supabase()
    try:
        transcript = (
            supabase.table("transcripts")
            .select("full_text")
            .eq("meeting_id", meeting_id)
            .single()
            .execute()
        )
        if not transcript.data or not transcript.data.get("full_text"):
            raise ValueError("No transcript found for this meeting.")

        _set_step(supabase, meeting_id, "analyzing")
        supabase.table("meetings").update({"status": "processing"}).eq("id", meeting_id).execute()
        await manager.push(meeting_id, {"step": "analyzing"})

        completed_tasks = _get_completed_tasks(supabase, meeting_id)
        analysis = await analyze_transcript(transcript.data["full_text"])
        _clear_analysis(supabase, meeting_id)
        _store_analysis(supabase, meeting_id, analysis, completed_tasks)

        _set_step(supabase, meeting_id, None)
        supabase.table("meetings").update({"status": "completed"}).eq("id", meeting_id).execute()
        await manager.push(meeting_id, {"step": "completed"})

    except Exception:
        error_msg = traceback.format_exc()
        _set_step(supabase, meeting_id, None)
        supabase.table("meetings").update(
            {"status": "failed", "error_message": error_msg[-500:]}
        ).eq("id", meeting_id).execute()
        await manager.push(meeting_id, {"step": "failed"})


# ── Processing ─────────────────────────────────────────────────────────────────

async def process_meeting(meeting_id: str, file_bytes: bytes, filename: str) -> None:
    supabase = get_supabase()

    try:
        _set_step(supabase, meeting_id, "transcribing")
        await manager.push(meeting_id, {"step": "transcribing"})

        transcript_data = await transcribe_audio(file_bytes, filename)

        supabase.table("transcripts").insert(
            {
                "meeting_id": meeting_id,
                "full_text": transcript_data["text"],
                "language": transcript_data.get("language"),
                "segments": transcript_data.get("segments", []),
            }
        ).execute()

        if transcript_data.get("duration"):
            supabase.table("meetings").update(
                {"duration_seconds": int(transcript_data["duration"])}
            ).eq("id", meeting_id).execute()

        _set_step(supabase, meeting_id, "analyzing")
        await manager.push(meeting_id, {"step": "analyzing"})

        analysis = await analyze_transcript(transcript_data["text"])
        try:
            _store_analysis(supabase, meeting_id, analysis)
        except Exception:
            _clear_analysis(supabase, meeting_id)
            raise

        _set_step(supabase, meeting_id, None)
        supabase.table("meetings").update({"status": "completed"}).eq("id", meeting_id).execute()
        await manager.push(meeting_id, {"step": "completed"})

    except Exception:
        error_msg = traceback.format_exc()
        _set_step(supabase, meeting_id, None)
        supabase.table("meetings").update(
            {"status": "failed", "error_message": error_msg[-500:]}
        ).eq("id", meeting_id).execute()
        await manager.push(meeting_id, {"step": "failed"})


async def append_to_meeting(meeting_id: str, file_bytes: bytes, filename: str) -> None:
    supabase = get_supabase()

    try:
        _set_step(supabase, meeting_id, "transcribing")
        supabase.table("meetings").update({"status": "processing"}).eq("id", meeting_id).execute()
        await manager.push(meeting_id, {"step": "transcribing"})

        # ── Load existing state ───────────────────────────────────────────────
        existing = (
            supabase.table("transcripts")
            .select("*")
            .eq("meeting_id", meeting_id)
            .single()
            .execute()
        )
        meeting_row = (
            supabase.table("meetings")
            .select("extra_audio_files")
            .eq("id", meeting_id)
            .single()
            .execute()
        )
        existing_text = existing.data["full_text"] if existing.data else ""
        existing_segments = existing.data.get("segments") or [] if existing.data else []
        time_offset = existing_segments[-1]["end"] if existing_segments else 0.0
        existing_extras = meeting_row.data.get("extra_audio_files") or [] if meeting_row.data else []
        audio_index = len(existing_extras) + 1  # 0 = original, 1 = first append, …

        # ── Transcribe & merge ───────────────────────────────────────────────
        new_data = await transcribe_audio(file_bytes, filename)

        # Offset timestamps and tag each segment with its recording number
        new_segments = [
            {
                **seg,
                "start": seg["start"] + time_offset,
                "end": seg["end"] + time_offset,
                "audio_index": audio_index,
            }
            for seg in new_data.get("segments", [])
        ]
        combined_text = (existing_text + "\n\n" + new_data["text"]).strip()
        combined_segments = existing_segments + new_segments
        new_duration = combined_segments[-1]["end"] if combined_segments else None

        if existing.data:
            supabase.table("transcripts").update(
                {"full_text": combined_text, "segments": combined_segments}
            ).eq("meeting_id", meeting_id).execute()
        else:
            supabase.table("transcripts").insert(
                {"meeting_id": meeting_id, "full_text": combined_text, "segments": combined_segments}
            ).execute()

        if new_duration:
            supabase.table("meetings").update(
                {"duration_seconds": int(new_duration)}
            ).eq("id", meeting_id).execute()

        # ── Upload extra audio file ───────────────────────────────────────────
        ext = os.path.splitext(filename)[1].lower() or ".mp3"
        storage_path = f"meetings/{meeting_id}_extra_{int(time.time())}{ext}"
        supabase.storage.from_("meeting-files").upload(
            storage_path,
            file_bytes,
            {"content-type": "audio/mpeg"},
        )
        extra_url = supabase.storage.from_("meeting-files").get_public_url(storage_path)
        uploaded_at = datetime.now(timezone.utc).isoformat()
        existing_extras.append({"url": extra_url, "file_name": filename, "uploaded_at": uploaded_at})
        supabase.table("meetings").update(
            {"extra_audio_files": existing_extras}
        ).eq("id", meeting_id).execute()

        # ── Analyze new recording only, add alongside existing data ──────────
        _set_step(supabase, meeting_id, "analyzing")
        await manager.push(meeting_id, {"step": "analyzing"})

        analysis = await analyze_transcript(new_data["text"])
        try:
            _store_analysis(
                supabase, meeting_id, analysis,
                recording_index=audio_index,
                include_intelligence=False,
            )
        except Exception:
            # Roll back only the newly inserted topics/action_items for this recording
            supabase.table("topics").delete().eq("meeting_id", meeting_id).eq("recording_index", audio_index).execute()
            supabase.table("action_items").delete().eq("meeting_id", meeting_id).eq("recording_index", audio_index).execute()
            raise

        # Update intelligence counts from all topics in DB (no extra LLM call)
        all_topics = supabase.table("topics").select("status").eq("meeting_id", meeting_id).execute().data or []
        supabase.table("meeting_intelligence").update({
            "total_topics": len(all_topics),
            "unresolved_count": sum(1 for t in all_topics if t["status"] == "pending"),
        }).eq("meeting_id", meeting_id).execute()

        _set_step(supabase, meeting_id, None)
        supabase.table("meetings").update({"status": "completed"}).eq("id", meeting_id).execute()
        await manager.push(meeting_id, {"step": "completed"})

    except Exception:
        error_msg = traceback.format_exc()
        _set_step(supabase, meeting_id, None)
        supabase.table("meetings").update(
            {"status": "failed", "error_message": error_msg[-500:]}
        ).eq("id", meeting_id).execute()
        await manager.push(meeting_id, {"step": "failed"})

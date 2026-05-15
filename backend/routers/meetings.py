from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from database import get_supabase
from models.schemas import MeetingListItem, MeetingDetail, ActionItemStatusUpdate, Topic, ActionItem, TranscriptData, MeetingIntelligence, Segment
from services.processor import reanalyze_meeting

router = APIRouter()


def _build_list_item(row: dict, topics: list, action_items: list) -> dict:
    resolved = sum(1 for t in topics if t["status"] == "resolved")
    pending = sum(1 for t in topics if t["status"] == "pending")
    return {
        **row,
        "total_topics": len(topics),
        "resolved_count": resolved,
        "pending_count": pending,
        "action_items_count": len(action_items),
    }


@router.get("/meetings", response_model=list[MeetingListItem])
async def list_meetings(
    search: str = Query(None),
    status: str = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
):
    supabase = get_supabase()

    query = supabase.table("meetings").select("*").order("created_at", desc=True).range(offset, offset + limit - 1)

    if status:
        query = query.eq("status", status)
    if search:
        query = query.ilike("title", f"%{search}%")

    meetings_result = query.execute()
    meetings = meetings_result.data or []

    if not meetings:
        return []

    meeting_ids = [m["id"] for m in meetings]

    topics_result = supabase.table("topics").select("meeting_id, status").in_("meeting_id", meeting_ids).execute()
    topics_by_meeting: dict[str, list] = {}
    for t in (topics_result.data or []):
        topics_by_meeting.setdefault(t["meeting_id"], []).append(t)

    actions_result = supabase.table("action_items").select("meeting_id").in_("meeting_id", meeting_ids).execute()
    actions_by_meeting: dict[str, list] = {}
    for a in (actions_result.data or []):
        actions_by_meeting.setdefault(a["meeting_id"], []).append(a)

    return [
        _build_list_item(m, topics_by_meeting.get(m["id"], []), actions_by_meeting.get(m["id"], []))
        for m in meetings
    ]


@router.get("/meetings/{meeting_id}", response_model=MeetingDetail)
async def get_meeting(meeting_id: str):
    supabase = get_supabase()

    meeting_result = supabase.table("meetings").select("*").eq("id", meeting_id).single().execute()
    if not meeting_result.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    meeting = meeting_result.data

    # Fetch related data in parallel via separate calls
    topics_result = supabase.table("topics").select("*").eq("meeting_id", meeting_id).order("recording_index").order("position").execute()
    topics = topics_result.data or []

    actions_result = (
        supabase.table("action_items")
        .select("*, topics(title)")
        .eq("meeting_id", meeting_id)
        .execute()
    )
    raw_actions = actions_result.data or []
    action_items = []
    for a in raw_actions:
        topic_title = None
        if a.get("topics"):
            topic_title = a["topics"].get("title")
        action_items.append({**a, "topic_title": topic_title})

    transcript_result = supabase.table("transcripts").select("*").eq("meeting_id", meeting_id).execute()
    transcript_data = None
    if transcript_result.data:
        t = transcript_result.data[0]
        transcript_data = {
            "full_text": t["full_text"],
            "language": t.get("language"),
            "segments": t.get("segments") or [],
        }

    intelligence_result = supabase.table("meeting_intelligence").select("*").eq("meeting_id", meeting_id).execute()
    intelligence = None
    if intelligence_result.data:
        i = intelligence_result.data[0]
        intelligence = {
            "summary": i.get("summary"),
            "key_decisions": i.get("key_decisions") or [],
            "unresolved_count": i.get("unresolved_count", 0),
            "total_topics": i.get("total_topics", 0),
        }

    resolved = sum(1 for t in topics if t["status"] == "resolved")
    pending = sum(1 for t in topics if t["status"] == "pending")

    return {
        **meeting,
        "total_topics": len(topics),
        "resolved_count": resolved,
        "pending_count": pending,
        "action_items_count": len(action_items),
        "topics": topics,
        "action_items": action_items,
        "transcript": transcript_data,
        "intelligence": intelligence,
    }


@router.patch("/meetings/{meeting_id}/action-items/{item_id}")
async def update_action_item(
    meeting_id: str, item_id: str, body: ActionItemStatusUpdate
):
    if body.status not in ("pending", "completed"):
        raise HTTPException(status_code=400, detail="status must be 'pending' or 'completed'")

    supabase = get_supabase()
    result = (
        supabase.table("action_items")
        .update({"status": body.status})
        .eq("id", item_id)
        .eq("meeting_id", meeting_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Action item not found")
    return result.data[0]


@router.post("/meetings/{meeting_id}/reanalyze", status_code=202)
async def reanalyze(meeting_id: str, background_tasks: BackgroundTasks):
    supabase = get_supabase()
    row = supabase.table("meetings").select("id, status").eq("id", meeting_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if row.data["status"] == "processing":
        raise HTTPException(status_code=409, detail="Meeting is already processing")
    background_tasks.add_task(reanalyze_meeting, meeting_id)
    return {"status": "processing"}


@router.delete("/meetings/{meeting_id}", status_code=204)
async def delete_meeting(meeting_id: str):
    supabase = get_supabase()
    supabase.table("meetings").delete().eq("id", meeting_id).execute()


@router.get("/search")
async def search_meetings(q: str = Query(..., min_length=1)):
    supabase = get_supabase()

    meetings_result = (
        supabase.table("meetings")
        .select("id, title, status, created_at")
        .ilike("title", f"%{q}%")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    topics_result = (
        supabase.table("topics")
        .select("meeting_id, title, status")
        .ilike("title", f"%{q}%")
        .limit(10)
        .execute()
    )

    return {
        "meetings": meetings_result.data or [],
        "topics": topics_result.data or [],
    }

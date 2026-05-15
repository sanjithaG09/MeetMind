from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from database import get_supabase
from ws_manager import manager

router = APIRouter()


@router.websocket("/ws/meetings/{meeting_id}")
async def meeting_ws(meeting_id: str, websocket: WebSocket):
    await manager.connect(meeting_id, websocket)

    # Catch up the client immediately in case the step event fired before
    # the WebSocket handshake completed (common race on fast machines).
    try:
        sb = get_supabase()
        row = (
            sb.table("meetings")
            .select("status, processing_step")
            .eq("id", meeting_id)
            .single()
            .execute()
        )
        if row.data:
            step = row.data.get("processing_step")
            status = row.data.get("status")
            if step:
                await websocket.send_json({"step": step})
            elif status == "completed":
                await websocket.send_json({"step": "completed"})
            elif status == "failed":
                await websocket.send_json({"step": "failed"})
    except Exception:
        pass  # non-fatal — live events will still arrive

    try:
        while True:
            await websocket.receive_text()  # keep-alive
    except WebSocketDisconnect:
        manager.disconnect(meeting_id, websocket)

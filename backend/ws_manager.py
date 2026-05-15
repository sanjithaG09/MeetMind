from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, meeting_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(meeting_id, []).append(websocket)

    def disconnect(self, meeting_id: str, websocket: WebSocket) -> None:
        conns = self._connections.get(meeting_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def push(self, meeting_id: str, data: dict) -> None:
        for ws in list(self._connections.get(meeting_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                pass


manager = ConnectionManager()

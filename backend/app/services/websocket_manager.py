from fastapi import WebSocket


class ConnectionManager:

    def __init__(self):
        self.connections: dict[int, list[WebSocket]] = {}

    async def connect(
        self,
        meeting_id: int,
        websocket: WebSocket
    ):
        await websocket.accept()

        if meeting_id not in self.connections:
            self.connections[meeting_id] = []

        self.connections[meeting_id].append(websocket)

    def disconnect(
        self,
        meeting_id: int,
        websocket: WebSocket
    ):
        if meeting_id not in self.connections:
            return

        if websocket in self.connections[meeting_id]:
            self.connections[meeting_id].remove(websocket)

        if not self.connections[meeting_id]:
            del self.connections[meeting_id]

    async def broadcast(
        self,
        meeting_id: int,
        message: dict
    ):
        connections = self.connections.get(
            meeting_id,
            []
        )

        disconnected = []

        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)

        for websocket in disconnected:
            self.disconnect(
                meeting_id,
                websocket
            )


manager = ConnectionManager()
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.websocket_manager import manager


router = APIRouter()


@router.websocket("/ws/meetings/{meeting_id}")
async def meeting_websocket(
    websocket: WebSocket,
    meeting_id: int
):
    await manager.connect(
        meeting_id,
        websocket
    )

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(
            meeting_id,
            websocket
        )

    except Exception:
        manager.disconnect(
            meeting_id,
            websocket
        )
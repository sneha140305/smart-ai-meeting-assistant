import json
import os
import shutil

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.database import get_db
from app.database.models import (
    User,
    Meeting,
    Transcript,
    ActionItem,
    SpeakerAnalytics,
)
from app.services.audio_processor import extract_audio
from app.services.transcription import transcribe_audio
from app.services.diarization import diarize_audio
from app.services.transcript_merger import merge_transcript_with_speakers
from app.services.meeting_ai import analyze_meeting
from app.services.analytics import calculate_meeting_analytics


router = APIRouter(
    prefix="/meetings",
    tags=["Meetings"]
)


# ============================================================
# CONFIGURATION
# ============================================================

UPLOAD_DIRECTORY = "uploads"

os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

ALLOWED_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".m4a",
    ".mp4",
    ".webm",
    ".mov",
}

MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_user_meeting(
    meeting_id: int,
    current_user: User,
    db: Session,
):
    """
    Get a meeting only if it belongs to the logged-in user.
    """

    meeting = (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.owner_id == current_user.id,
        )
        .first()
    )

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found",
        )

    return meeting


def get_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


# ============================================================
# UPLOAD MEETING
# ============================================================

@router.post("/upload")
async def upload_meeting(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a meeting recording.

    Supported:
    MP3, WAV, M4A, MP4, WEBM, MOV
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="File name is missing",
        )

    extension = get_extension(file.filename)

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file format. "
                "Supported formats: MP3, WAV, M4A, MP4, WEBM, MOV"
            ),
        )

    # Read file
    file_data = await file.read()

    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds the 500 MB limit.",
        )

    # Safe filename
    safe_filename = os.path.basename(file.filename)

    file_path = os.path.join(
        UPLOAD_DIRECTORY,
        safe_filename,
    )

    # Avoid overwriting an existing file
    base_name, ext = os.path.splitext(safe_filename)

    counter = 1

    while os.path.exists(file_path):
        file_path = os.path.join(
            UPLOAD_DIRECTORY,
            f"{base_name}_{counter}{ext}",
        )
        counter += 1

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_data)

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save uploaded file: {str(error)}",
        )

    # Create meeting record first
    meeting = Meeting(
        title=title,
        file_name=safe_filename,
        file_path=file_path,
        owner_id=current_user.id,
        status="processing",
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # Extract audio
    try:
        audio_path = extract_audio(
            file_path,
            meeting.id,
        )

        meeting.audio_path = audio_path
        meeting.status = "audio_ready"

        db.commit()
        db.refresh(meeting)

    except Exception as error:
        meeting.status = "audio_processing_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Audio processing failed: {str(error)}",
        )

    return {
        "message": "Meeting uploaded successfully",
        "meeting_id": meeting.id,
        "title": meeting.title,
        "file_name": meeting.file_name,
        "status": meeting.status,
    }


# ============================================================
# GET ALL USER MEETINGS
# ============================================================

@router.get("/")
def get_meetings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all meetings belonging to the logged-in user.
    """

    meetings = (
        db.query(Meeting)
        .filter(
            Meeting.owner_id == current_user.id
        )
        .order_by(Meeting.created_at.desc())
        .all()
    )

    return meetings


# ============================================================
# GET SINGLE MEETING
# ============================================================

@router.get("/{meeting_id}")
def get_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return one meeting.
    """

    meeting = get_user_meeting(
        meeting_id,
        current_user,
        db,
    )

    return meeting


# ============================================================
# TRANSCRIBE AUDIO
# ============================================================

@router.post("/{meeting_id}/transcribe")
def transcribe_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Transcribe the processed meeting audio using Faster-Whisper.
    """

    meeting = get_user_meeting(
        meeting_id,
        current_user,
        db,
    )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Audio file is not available for this meeting.",
        )

    if not os.path.exists(meeting.audio_path):
        raise HTTPException(
            status_code=404,
            detail="Processed audio file not found.",
        )

    try:
        meeting.status = "transcribing"
        db.commit()

        result = transcribe_audio(
            meeting.audio_path
        )

        segments = result.get(
            "segments",
            [],
        )

        transcript_text = "\n".join(
            segment.get("text", "")
            for segment in segments
        )

        transcript = (
            db.query(Transcript)
            .filter(
                Transcript.meeting_id == meeting.id
            )
            .first()
        )

        if transcript:
            transcript.content = transcript_text
            transcript.language = result.get(
                "language"
            )
            transcript.segments = json.dumps(
                segments
            )

        else:
            transcript = Transcript(
                content=transcript_text,
                language=result.get("language"),
                segments=json.dumps(segments),
                meeting_id=meeting.id,
            )

            db.add(transcript)

        meeting.status = "transcribed"

        db.commit()
        db.refresh(transcript)

        return {
            "message": "Transcription completed",
            "meeting_id": meeting.id,
            "language": result.get("language"),
            "language_probability": result.get(
                "language_probability"
            ),
            "segments": segments,
        }

    except Exception as error:
        meeting.status = "transcription_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(error)}",
        )


# ============================================================
# GET TRANSCRIPT
# ============================================================

@router.get("/{meeting_id}/transcript")
def get_transcript(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return transcript and structured segments.
    """

    meeting = get_user_meeting(
        meeting_id,
        current_user,
        db,
    )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id == meeting.id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=404,
            detail="Transcript not found. Please transcribe the meeting first.",
        )

    segments = []

    if transcript.segments:
        try:
            parsed_segments = json.loads(
                transcript.segments
            )

            if isinstance(
                parsed_segments,
                list,
            ):
                segments = parsed_segments

        except json.JSONDecodeError:
            segments = []

    return {
        "id": transcript.id,
        "content": transcript.content,
        "language": transcript.language,
        "segments": segments,
    }


# ============================================================
# DIARIZE SPEAKERS
# ============================================================

@router.post("/{meeting_id}/diarize")
def diarize_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Identify speakers using pyannote and merge
    speaker labels into transcript segments.
    """

    meeting = get_user_meeting(
        meeting_id,
        current_user,
        db,
    )

    if not meeting.audio_path:
        raise HTTPException(
            status_code=400,
            detail="Audio file is not available.",
        )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id == meeting.id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript not found. Please transcribe the meeting first.",
        )

    if not transcript.segments:
        raise HTTPException(
            status_code=400,
            detail="Transcript segments are empty.",
        )

    try:
        meeting.status = "diarizing"
        db.commit()

        transcript_segments = json.loads(
            transcript.segments
        )

        speaker_segments = diarize_audio(
            meeting.audio_path
        )

        merged_segments = (
            merge_transcript_with_speakers(
                transcript_segments,
                speaker_segments,
            )
        )

        # Update structured transcript
        transcript.segments = json.dumps(
            merged_segments
        )

        # Update readable transcript
        transcript.content = "\n".join(
            f"{segment.get('speaker', 'UNKNOWN')}: "
            f"{segment.get('text', '')}"
            for segment in merged_segments
        )

        meeting.status = "transcribed"

        db.commit()
        db.refresh(transcript)

        return {
            "message": "Speaker diarization completed",
            "meeting_id": meeting.id,
            "segments": merged_segments,
        }

    except Exception as error:
        meeting.status = "diarization_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Speaker diarization failed: {str(error)}",
        )


# ============================================================
# AI MEETING ANALYSIS
# ============================================================

@router.post("/{meeting_id}/analyze")
def analyze_meeting_endpoint(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run local Ollama analysis on the meeting transcript.

    Generates:
    - Summary
    - Key points
    - Decisions
    - Action items
    - Meeting analytics
    """

    meeting = get_user_meeting(
        meeting_id,
        current_user,
        db,
    )

    transcript = (
        db.query(Transcript)
        .filter(
            Transcript.meeting_id == meeting.id
        )
        .first()
    )

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript not found. Please transcribe the meeting first.",
        )

    if not transcript.content:
        raise HTTPException(
            status_code=400,
            detail="Transcript is empty.",
        )

    try:
        meeting.status = "analyzing"
        db.commit()

        # --------------------------------------------
        # AI ANALYSIS
        # --------------------------------------------

        result = analyze_meeting(
            transcript.content
        )

        summary = result.get(
            "summary",
            "",
        )

        key_points = result.get(
            "key_points",
            [],
        )

        decisions = result.get(
            "decisions",
            [],
        )

        ai_action_items = result.get(
            "action_items",
            [],
        )

        # --------------------------------------------
        # SAVE AI RESULTS
        # --------------------------------------------

        meeting.summary = summary

        meeting.key_points = json.dumps(
            key_points
        )

        meeting.decisions = json.dumps(
            decisions
        )

        # --------------------------------------------
        # DELETE OLD ACTION ITEMS
        # --------------------------------------------

        db.query(ActionItem).filter(
            ActionItem.meeting_id == meeting.id
        ).delete(
            synchronize_session=False
        )

        # --------------------------------------------
        # CREATE NEW ACTION ITEMS
        # --------------------------------------------

        for item in ai_action_items:

            if not isinstance(item, dict):
                continue

            task = str(
                item.get("task", "")
            ).strip()

            if not task:
                continue

            assigned_to = item.get(
                "assigned_to",
                "Unknown",
            )

            deadline = item.get(
                "deadline",
                "Not mentioned",
            )

            action_item = ActionItem(
                task=task,
                assigned_to=assigned_to,
                deadline=deadline,
                status="pending",
                meeting_id=meeting.id,
            )

            db.add(action_item)

        # --------------------------------------------
        # ANALYTICS
        # --------------------------------------------

        segments = []

        if transcript.segments:
            try:
                parsed_segments = json.loads(
                    transcript.segments
                )

                if isinstance(
                    parsed_segments,
                    list,
                ):
                    segments = parsed_segments

            except json.JSONDecodeError:
                segments = []

        analytics = calculate_meeting_analytics(
            segments
        )

        meeting.total_words = analytics.get(
            "total_words",
            0,
        )

        meeting.speaker_count = analytics.get(
            "speaker_count",
            0,
        )

        meeting.positive_sentiment = analytics.get(
            "positive_sentiment",
            0,
        )

        meeting.negative_sentiment = analytics.get(
            "negative_sentiment",
            0,
        )

        meeting.neutral_sentiment = analytics.get(
            "neutral_sentiment",
            0,
        )

        # --------------------------------------------
        # SPEAKER ANALYTICS
        # --------------------------------------------

        db.query(SpeakerAnalytics).filter(
            SpeakerAnalytics.meeting_id == meeting.id
        ).delete(
            synchronize_session=False
        )

        speaker_data = analytics.get(
            "speaker_analytics",
            [],
        )

        for speaker in speaker_data:

            if not isinstance(
                speaker,
                dict,
            ):
                continue

            speaker_name = speaker.get(
                "speaker",
                "UNKNOWN",
            )

            speaking_time = speaker.get(
                "speaking_time",
                0,
            )

            word_count = speaker.get(
                "word_count",
                0,
            )

            speaker_record = SpeakerAnalytics(
                speaker=speaker_name,
                speaking_time=speaking_time,
                word_count=word_count,
                meeting_id=meeting.id,
            )

            db.add(speaker_record)

        # --------------------------------------------
        # DURATION
        # --------------------------------------------

        if segments:
            try:
                last_end = max(
                    float(
                        segment.get(
                            "end",
                            0,
                        )
                    )
                    for segment in segments
                )

                if last_end > 0:
                    meeting.duration = int(
                        last_end
                    )

            except Exception:
                pass

        # --------------------------------------------
        # FINAL STATUS
        # --------------------------------------------

        meeting.status = "completed"

        db.commit()

        # Refresh records
        db.refresh(meeting)

        saved_action_items = (
            db.query(ActionItem)
            .filter(
                ActionItem.meeting_id == meeting.id
            )
            .all()
        )

        saved_speaker_analytics = (
            db.query(SpeakerAnalytics)
            .filter(
                SpeakerAnalytics.meeting_id
                == meeting.id
            )
            .all()
        )

        return {
            "message": "Meeting analysis completed",

            "meeting_id": meeting.id,

            "summary": meeting.summary,

            "key_points": key_points,

            "decisions": decisions,

            "action_items": [
                {
                    "id": item.id,
                    "task": item.task,
                    "assigned_to": item.assigned_to,
                    "deadline": item.deadline,
                    "status": item.status,
                }
                for item in saved_action_items
            ],

            "analytics": {
                "total_words": meeting.total_words,
                "speaker_count": meeting.speaker_count,
                "positive_sentiment": meeting.positive_sentiment,
                "negative_sentiment": meeting.negative_sentiment,
                "neutral_sentiment": meeting.neutral_sentiment,

                "speaker_analytics": [
                    {
                        "id": speaker.id,
                        "speaker": speaker.speaker,
                        "speaking_time": speaker.speaking_time,
                        "word_count": speaker.word_count,
                    }
                    for speaker in saved_speaker_analytics
                ],
            },

            "status": meeting.status,
        }

    except Exception as error:

        meeting.status = "analysis_failed"
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Meeting analysis failed: {str(error)}",
        )


# ============================================================
# GET ACTION ITEMS
# ============================================================

@router.get("/{meeting_id}/action-items")
def get_action_items(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return action items for a meeting.
    """

    meeting = get_user_meeting(
        meeting_id,
        current_user,
        db,
    )

    action_items = (
        db.query(ActionItem)
        .filter(
            ActionItem.meeting_id == meeting.id
        )
        .order_by(ActionItem.id.asc())
        .all()
    )

    return [
        {
            "id": item.id,
            "task": item.task,
            "assigned_to": item.assigned_to,
            "deadline": item.deadline,
            "status": item.status or "pending",
            "meeting_id": item.meeting_id,
        }
        for item in action_items
    ]


# ============================================================
# UPDATE ACTION ITEM STATUS
# ============================================================

@router.patch(
    "/{meeting_id}/action-items/{action_item_id}"
)
def update_action_item(
    meeting_id: int,
    action_item_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update action item status.
    """

    meeting = get_user_meeting(
        meeting_id,
        current_user,
        db,
    )

    action_item = (
        db.query(ActionItem)
        .filter(
            ActionItem.id == action_item_id,
            ActionItem.meeting_id == meeting.id,
        )
        .first()
    )

    if not action_item:
        raise HTTPException(
            status_code=404,
            detail="Action item not found",
        )

    allowed_statuses = {
        "pending",
        "in_progress",
        "completed",
    }

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Status must be one of: "
                "pending, in_progress, completed"
            ),
        )

    action_item.status = status

    db.commit()
    db.refresh(action_item)

    return {
        "id": action_item.id,
        "task": action_item.task,
        "assigned_to": action_item.assigned_to,
        "deadline": action_item.deadline,
        "status": action_item.status,
        "meeting_id": action_item.meeting_id,
    }


# ============================================================
# GET SPEAKER ANALYTICS
# ============================================================

@router.get("/{meeting_id}/speaker-analytics")
def get_speaker_analytics(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return speaker-level analytics.

    If analytics have not been generated yet,
    return an empty list instead of 400.
    """

    meeting = get_user_meeting(
        meeting_id,
        current_user,
        db,
    )

    analytics = (
        db.query(SpeakerAnalytics)
        .filter(
            SpeakerAnalytics.meeting_id == meeting.id
        )
        .order_by(
            SpeakerAnalytics.speaking_time.desc()
        )
        .all()
    )

    return [
        {
            "id": item.id,
            "speaker": item.speaker,
            "speaking_time": item.speaking_time,
            "word_count": item.word_count,
            "meeting_id": item.meeting_id,
        }
        for item in analytics
    ]


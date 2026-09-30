from app.services.meeting_score import calculate_meeting_score
from app.services.transcript_merger import merge_transcript_with_speakers


def test_transcript_merger_assigns_speakers():
    transcript = [{"start": 0, "end": 2, "text": "Hello"}]
    speakers = [{"start": 0, "end": 3, "speaker": "SPEAKER_00"}]

    result = merge_transcript_with_speakers(transcript, speakers)

    assert result[0]["speaker"] == "SPEAKER_00"


def test_transcript_merger_falls_back_to_unknown():
    transcript = [{"start": 0, "end": 2, "text": "Hello"}]

    result = merge_transcript_with_speakers(transcript, [])

    assert result[0]["speaker"] == "UNKNOWN"


def test_meeting_score_is_bounded():
    result = calculate_meeting_score(
        total_words=500,
        speaker_count=2,
        positive_sentiment=4,
        negative_sentiment=1,
        neutral_sentiment=2,
        action_items=[object(), object()],
        duration=900,
    )

    score = result["score"] if isinstance(result, dict) else result
    assert 0 <= score <= 100

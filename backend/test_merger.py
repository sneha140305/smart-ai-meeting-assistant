from app.services.transcript_merger import assign_speakers


transcript = [
    {
        "start": 0.5,
        "end": 4.0,
        "text": "Good morning everyone."
    },
    {
        "start": 4.2,
        "end": 8.7,
        "text": "Today we'll discuss the project."
    }
]


speakers = [
    {
        "start": 0.4,
        "end": 4.1,
        "speaker": "SPEAKER_00"
    },
    {
        "start": 4.2,
        "end": 8.8,
        "speaker": "SPEAKER_01"
    }
]


result = assign_speakers(
    transcript,
    speakers
)


for segment in result:
    print(
        f"[{segment['start']} - "
        f"{segment['end']}] "
        f"{segment['speaker']}: "
        f"{segment['text']}"
    )
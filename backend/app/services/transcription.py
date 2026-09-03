from faster_whisper import WhisperModel


MODEL_SIZE = "small"


model = WhisperModel(
    MODEL_SIZE,
    device="cpu",
    compute_type="int8"
)


def transcribe_audio(audio_path: str):

    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        vad_filter=True
    )

    transcript_segments = []

    for segment in segments:
        transcript_segments.append({
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip()
        })

    return {
        "language": info.language,
        "language_probability": round(
            info.language_probability,
            4
        ),
        "segments": transcript_segments
    }
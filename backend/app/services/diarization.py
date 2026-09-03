import os

from dotenv import load_dotenv
from pyannote.audio import Pipeline


load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    raise RuntimeError(
        "HF_TOKEN is not configured in the .env file."
    )


pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-community-1",
    token=HF_TOKEN
)


def diarize_audio(audio_path: str):
    output = pipeline(audio_path)

    # Community-1 returns a DiarizeOutput object.
    # The actual speaker diarization annotation is stored
    # in the speaker_diarization attribute.
    diarization = output.speaker_diarization

    speaker_segments = []

    for turn, _, speaker in diarization.itertracks(
        yield_label=True
    ):
        speaker_segments.append({
            "start": round(turn.start, 2),
            "end": round(turn.end, 2),
            "speaker": speaker
        })

    return speaker_segments
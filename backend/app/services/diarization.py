import os
import numpy as np
import soundfile as sf
import torch

from dotenv import load_dotenv
from pyannote.audio import Pipeline

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    raise RuntimeError("HF_TOKEN is not configured in .env")


pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-community-1",
    token=HF_TOKEN
)


def diarize_audio(audio_path: str):
    print("\n" + "=" * 60)
    print("STARTING SPEAKER DIARIZATION")
    print("=" * 60)

    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    print(f"Audio file: {audio_path}")

    # ---------------------------------------------------------
    # Load audio using soundfile
    # This avoids TorchCodec problems on Windows
    # ---------------------------------------------------------

    waveform, sample_rate = sf.read(
        audio_path,
        dtype="float32"
    )

    # Convert stereo -> mono
    if waveform.ndim == 1:
        waveform = waveform[np.newaxis, :]
    else:
        waveform = waveform.T
        waveform = np.mean(
            waveform,
            axis=0,
            keepdims=True
        )

    waveform_tensor = torch.from_numpy(
        waveform
    ).float()

    print(f"Loaded audio: {waveform_tensor.shape[1]} samples")
    print(f"Sample rate: {sample_rate}")
    print(f"Waveform shape: {waveform_tensor.shape}")

    audio = {
        "waveform": waveform_tensor,
        "sample_rate": sample_rate
    }

    # ---------------------------------------------------------
    # Automatic speaker detection
    # ---------------------------------------------------------

    output = pipeline(audio)

    print("\n" + "=" * 60)
    print("PYANNOTE OUTPUT")
    print("=" * 60)

    speaker_segments = []

    for turn, speaker in output.speaker_diarization:

        speaker_name = str(speaker)

        segment = {
            "start": round(float(turn.start), 2),
            "end": round(float(turn.end), 2),
            "speaker": speaker_name
        }

        speaker_segments.append(segment)

        print(
            f"{segment['start']}s - "
            f"{segment['end']}s : "
            f"{segment['speaker']}"
        )

    # ---------------------------------------------------------
    # Speaker statistics
    # ---------------------------------------------------------

    unique_speakers = sorted(
        {
            segment["speaker"]
            for segment in speaker_segments
        }
    )

    print("\n" + "=" * 60)
    print(f"DETECTED SPEAKERS: {len(unique_speakers)}")
    print(f"SPEAKER LABELS: {set(unique_speakers)}")
    print("=" * 60)

    return speaker_segments
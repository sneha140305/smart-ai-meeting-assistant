import os

import av
import numpy as np
import torch
from dotenv import load_dotenv
from pyannote.audio import Pipeline


load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    raise RuntimeError("HF_TOKEN is not configured in the .env file.")


pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-community-1",
    token=HF_TOKEN
)


def load_audio_for_diarization(
    audio_path: str,
    sampling_rate: int = 16000
):
    """
    Load audio using PyAV so Pyannote does not need TorchCodec.
    Returns a waveform dictionary compatible with pyannote.audio 4.x.
    """

    try:
        container = av.open(audio_path)

        audio_stream = next(
            (
                stream
                for stream in container.streams
                if stream.type == "audio"
            ),
            None
        )

        if audio_stream is None:
            container.close()
            raise RuntimeError("No audio stream found.")

        resampler = av.audio.resampler.AudioResampler(
            format="s16",
            layout="mono",
            rate=sampling_rate
        )

        audio_chunks = []

        for frame in container.decode(audio=0):
            resampled_frames = resampler.resample(frame)

            if not isinstance(resampled_frames, list):
                resampled_frames = [resampled_frames]

            for resampled_frame in resampled_frames:
                audio_array = resampled_frame.to_ndarray()

                if audio_array.ndim > 1:
                    audio_array = audio_array[0]

                audio_chunks.append(audio_array)

        container.close()

        if not audio_chunks:
            raise RuntimeError("No audio data could be decoded.")

        audio = np.concatenate(audio_chunks).astype(np.float32)

        # Convert int16 audio to float32 range [-1, 1]
        audio /= 32768.0

        waveform = torch.from_numpy(audio).unsqueeze(0)

        return {
            "waveform": waveform,
            "sample_rate": sampling_rate
        }

    except Exception as exc:
        raise RuntimeError(
            f"Could not load audio for diarization: {exc}"
        ) from exc


def diarize_audio(audio_path: str):
    """
    Identify different speakers and return their speaking intervals.
    """

    audio = load_audio_for_diarization(audio_path)

    try:
        output = pipeline(audio)

        speaker_segments = []

        for turn, speaker in output.speaker_diarization:
            speaker_segments.append(
                {
                    "start": round(turn.start, 2),
                    "end": round(turn.end, 2),
                    "speaker": str(speaker)
                }
            )

        return speaker_segments

    except Exception as exc:
        raise RuntimeError(
            f"Speaker diarization failed: {exc}"
        ) from exc
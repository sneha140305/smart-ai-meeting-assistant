import av
import numpy as np
from faster_whisper import WhisperModel


MODEL_SIZE = "small"


# Load Whisper once when the application starts.
model = WhisperModel(
    MODEL_SIZE,
    device="cpu",
    compute_type="int8"
)


def load_audio(audio_path: str, sampling_rate: int = 16000):
    """
    Decode audio using PyAV.

    PyAV bundles its own FFmpeg libraries, so this avoids
    TorchCodec and Windows FFmpeg DLL compatibility problems.
    """

    try:
        container = av.open(audio_path)

        audio_stream = next(
            (stream for stream in container.streams if stream.type == "audio"),
            None
        )

        if audio_stream is None:
            container.close()
            raise RuntimeError("No audio stream found in the file.")

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

        # Convert int16 PCM to float32 [-1, 1]
        audio /= 32768.0

        return audio

    except Exception as exc:
        raise RuntimeError(
            f"Could not decode audio file: {exc}"
        ) from exc


def transcribe_audio(audio_path: str):
    """
    Transcribe audio using Faster-Whisper.

    Audio is decoded by PyAV and passed directly as a NumPy
    waveform, so TorchCodec is not required.
    """

    audio = load_audio(audio_path)

    segments, info = model.transcribe(
        audio,
        beam_size=5,
        vad_filter=True
    )

    transcript_segments = []

    for segment in segments:
        transcript_segments.append(
            {
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip()
            }
        )

    return {
        "language": info.language,
        "language_probability": round(
            info.language_probability,
            4
        ),
        "segments": transcript_segments
    }



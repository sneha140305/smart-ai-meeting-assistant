import os
import subprocess
from pathlib import Path


PROCESSED_DIRECTORY = "processed_audio"


os.makedirs(
    PROCESSED_DIRECTORY,
    exist_ok=True
)


def extract_audio(
    input_file: str,
    meeting_id: int
) -> str:

    output_file = os.path.join(
        PROCESSED_DIRECTORY,
        f"meeting_{meeting_id}.wav"
    )

    command = [
        "ffmpeg",
        "-y",
        "-i",
        input_file,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-sample_fmt",
        "s16",
        output_file
    ]

    try:
        subprocess.run(
            command,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

    except FileNotFoundError:
        raise RuntimeError(
            "FFmpeg is not installed or not available in PATH."
        )

    except subprocess.CalledProcessError as error:
        error_message = error.stderr.decode(
            "utf-8",
            errors="ignore"
        )

        raise RuntimeError(
            f"Audio processing failed: {error_message}"
        )

    return output_file
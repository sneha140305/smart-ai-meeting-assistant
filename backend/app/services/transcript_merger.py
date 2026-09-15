def calculate_overlap(
    transcript_start: float,
    transcript_end: float,
    speaker_start: float,
    speaker_end: float,
) -> float:
    """
    Calculate the amount of time two segments overlap.
    """

    overlap_start = max(
        transcript_start,
        speaker_start,
    )

    overlap_end = min(
        transcript_end,
        speaker_end,
    )

    return max(
        0.0,
        overlap_end - overlap_start,
    )


def merge_transcript_with_speakers(
    transcript_segments,
    speaker_segments,
):
    """
    Assign the most likely speaker to every
    Whisper transcript segment.

    transcript_segments:
        [
            {
                "start": 0.0,
                "end": 3.5,
                "text": "Hello everyone"
            }
        ]

    speaker_segments:
        [
            {
                "start": 0.0,
                "end": 4.0,
                "speaker": "SPEAKER_00"
            }
        ]

    Returns:
        [
            {
                "start": 0.0,
                "end": 3.5,
                "text": "Hello everyone",
                "speaker": "SPEAKER_00"
            }
        ]
    """

    if not transcript_segments:
        return []

    if not speaker_segments:
        return [
            {
                **segment,
                "speaker": "UNKNOWN",
            }
            for segment in transcript_segments
        ]

    merged_segments = []

    for transcript_segment in transcript_segments:

        transcript_start = float(
            transcript_segment.get(
                "start",
                0,
            )
            or 0
        )

        transcript_end = float(
            transcript_segment.get(
                "end",
                transcript_start,
            )
            or transcript_start
        )

        best_speaker = "UNKNOWN"
        best_overlap = 0.0

        # --------------------------------------------------------
        # FIND SPEAKER WITH MAXIMUM OVERLAP
        # --------------------------------------------------------

        for speaker_segment in speaker_segments:

            speaker_start = float(
                speaker_segment.get(
                    "start",
                    0,
                )
                or 0
            )

            speaker_end = float(
                speaker_segment.get(
                    "end",
                    speaker_start,
                )
                or speaker_start
            )

            speaker = speaker_segment.get(
                "speaker",
                "UNKNOWN",
            )

            overlap = calculate_overlap(
                transcript_start,
                transcript_end,
                speaker_start,
                speaker_end,
            )

            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker

        # --------------------------------------------------------
        # CREATE MERGED SEGMENT
        # --------------------------------------------------------

        merged_segment = {
            "start": round(
                transcript_start,
                2,
            ),
            "end": round(
                transcript_end,
                2,
            ),
            "text": str(
                transcript_segment.get(
                    "text",
                    "",
                )
            ).strip(),
            "speaker": best_speaker,
        }

        merged_segments.append(
            merged_segment
        )

    return merged_segments


def merge_transcript(
    transcript_segments,
    speaker_segments,
):
    """
    Backward-compatible alias.

    This allows older code that uses
    merge_transcript() to continue working.
    """

    return merge_transcript_with_speakers(
        transcript_segments,
        speaker_segments,
    )


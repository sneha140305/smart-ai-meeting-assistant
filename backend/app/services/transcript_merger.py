def calculate_overlap(
    start_a: float,
    end_a: float,
    start_b: float,
    end_b: float
) -> float:

    overlap_start = max(
        start_a,
        start_b
    )

    overlap_end = min(
        end_a,
        end_b
    )

    return max(
        0.0,
        overlap_end - overlap_start
    )


def assign_speakers(
    transcript_segments,
    speaker_segments
):

    result = []

    for transcript in transcript_segments:

        best_speaker = "UNKNOWN"
        best_overlap = 0.0

        for speaker in speaker_segments:

            overlap = calculate_overlap(
                transcript["start"],
                transcript["end"],
                speaker["start"],
                speaker["end"]
            )

            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker["speaker"]

        result.append({
            **transcript,
            "speaker": best_speaker
        })

    return result
def calculate_overlap(
    start_a,
    end_a,
    start_b,
    end_b
):
    overlap_start = max(start_a, start_b)
    overlap_end = min(end_a, end_b)

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

        transcript_start = float(
            transcript.get("start", 0)
        )

        transcript_end = float(
            transcript.get("end", 0)
        )

        best_speaker = "UNKNOWN"
        best_overlap = 0.0

        for speaker in speaker_segments:

            speaker_start = float(
                speaker.get("start", 0)
            )

            speaker_end = float(
                speaker.get("end", 0)
            )

            overlap = calculate_overlap(
                transcript_start,
                transcript_end,
                speaker_start,
                speaker_end
            )

            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker.get(
                    "speaker",
                    "UNKNOWN"
                )

        result.append({
            **transcript,
            "speaker": best_speaker
        })

    return result


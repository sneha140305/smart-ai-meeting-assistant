from collections import defaultdict

from app.services.sentiment import analyze_sentiment


def calculate_meeting_analytics(transcript_segments):

    speaker_data = defaultdict(
        lambda: {
            "speaking_time": 0.0,
            "word_count": 0
        }
    )

    sentiment_counts = {
        "positive": 0,
        "negative": 0,
        "neutral": 0
    }

    total_words = 0

    for segment in transcript_segments:

        text = segment.get(
            "text",
            ""
        ).strip()

        speaker = segment.get(
            "speaker",
            "UNKNOWN"
        )

        start = float(
            segment.get("start", 0)
        )

        end = float(
            segment.get("end", 0)
        )

        speaking_time = max(
            0,
            end - start
        )

        word_count = len(
            text.split()
        )

        # Speaker statistics
        speaker_data[speaker][
            "speaking_time"
        ] += speaking_time

        speaker_data[speaker][
            "word_count"
        ] += word_count

        total_words += word_count

        # Sentiment
        sentiment = analyze_sentiment(text)

        label = sentiment["label"]

        if label in sentiment_counts:
            sentiment_counts[label] += 1

    # Prepare speaker results
    speakers = {}

    for speaker, data in speaker_data.items():

        speaking_percentage = 0

        if total_words > 0:
            speaking_percentage = (
                data["word_count"]
                / total_words
            ) * 100

        speakers[speaker] = {
            "speaking_time": round(
                data["speaking_time"],
                2
            ),
            "word_count": data["word_count"],
            "speaking_percentage": round(
                speaking_percentage,
                2
            )
        }

    # Meeting duration
    duration_seconds = 0

    if transcript_segments:

        duration_seconds = max(
            float(segment.get("end", 0))
            for segment in transcript_segments
        )

    return {
        "duration_seconds": round(
            duration_seconds,
            2
        ),
        "total_words": total_words,
        "speaker_count": len(speaker_data),
        "speakers": speakers,
        "sentiment": sentiment_counts
    }
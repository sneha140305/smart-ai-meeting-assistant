import json
from collections import defaultdict

from app.services.sentiment import analyze_sentiment


def calculate_meeting_analytics(segments):
    """
    Calculate meeting-level and speaker-level analytics.

    Input:
        segments = [
            {
                "start": 0.0,
                "end": 4.2,
                "text": "Hello everyone",
                "speaker": "SPEAKER_00"
            },
            ...
        ]

    Returns:
        {
            "total_words": int,
            "speaker_count": int,
            "positive_sentiment": int,
            "negative_sentiment": int,
            "neutral_sentiment": int,
            "speaker_analytics": [...]
        }
    """

    if not segments:
        return {
            "total_words": 0,
            "speaker_count": 0,
            "positive_sentiment": 0,
            "negative_sentiment": 0,
            "neutral_sentiment": 0,
            "speaker_analytics": [],
        }

    # ============================================================
    # BASIC COUNTERS
    # ============================================================

    total_words = 0

    positive_sentiment = 0
    negative_sentiment = 0
    neutral_sentiment = 0

    # Speaker information
    speaker_stats = defaultdict(
        lambda: {
            "speaking_time": 0.0,
            "word_count": 0,
        }
    )

    # ============================================================
    # PROCESS SEGMENTS
    # ============================================================

    for segment in segments:

        if not isinstance(segment, dict):
            continue

        text = str(
            segment.get("text", "")
        ).strip()

        if not text:
            continue

        # --------------------------------------------------------
        # WORD COUNT
        # --------------------------------------------------------

        words = text.split()
        word_count = len(words)

        total_words += word_count

        # --------------------------------------------------------
        # SPEAKER
        # --------------------------------------------------------

        speaker = (
            segment.get("speaker")
            or "UNKNOWN"
        )

        speaker = str(speaker)

        # --------------------------------------------------------
        # SPEAKING TIME
        # --------------------------------------------------------

        try:
            start = float(
                segment.get("start", 0)
                or 0
            )

            end = float(
                segment.get("end", 0)
                or 0
            )

            duration = max(
                0.0,
                end - start
            )

        except (
            TypeError,
            ValueError,
        ):
            duration = 0.0

        speaker_stats[speaker][
            "speaking_time"
        ] += duration

        speaker_stats[speaker][
            "word_count"
        ] += word_count

        # --------------------------------------------------------
        # SENTIMENT
        # --------------------------------------------------------

        try:
            sentiment = analyze_sentiment(
                text
            )

            label = str(
                sentiment.get(
                    "label",
                    "neutral"
                )
            ).lower()

            if label == "positive":
                positive_sentiment += 1

            elif label == "negative":
                negative_sentiment += 1

            else:
                neutral_sentiment += 1

        except Exception as error:
            # Sentiment failure should not
            # break the complete meeting analysis.
            print(
                f"Sentiment analysis failed: {error}"
            )

            neutral_sentiment += 1

    # ============================================================
    # SPEAKER COUNT
    # ============================================================

    speaker_count = len(
        speaker_stats
    )

    # ============================================================
    # SPEAKER ANALYTICS
    # ============================================================

    speaker_analytics = []

    for speaker, stats in speaker_stats.items():

        speaker_analytics.append(
            {
                "speaker": speaker,
                "speaking_time": round(
                    stats["speaking_time"],
                    2
                ),
                "word_count": stats[
                    "word_count"
                ],
            }
        )

    # Sort most active speakers first
    speaker_analytics.sort(
        key=lambda item: item[
            "word_count"
        ],
        reverse=True,
    )

    # ============================================================
    # RETURN RESULT
    # ============================================================

    return {
        "total_words": total_words,

        "speaker_count": speaker_count,

        "positive_sentiment": (
            positive_sentiment
        ),

        "negative_sentiment": (
            negative_sentiment
        ),

        "neutral_sentiment": (
            neutral_sentiment
        ),

        "speaker_analytics": (
            speaker_analytics
        ),
    }

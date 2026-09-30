from collections import defaultdict

from app.services.sentiment import analyze_sentiment


def calculate_meeting_analytics(segments, sentiment_counts=None):
    """Calculate meeting-level and speaker-level analytics.

    If ``sentiment_counts`` is supplied by the processing pipeline, those
    counts are reused so the sentiment model is not run twice. When counts
    are omitted, this function calculates them itself for standalone use.
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

    total_words = 0
    speaker_stats = defaultdict(
        lambda: {"speaking_time": 0.0, "word_count": 0}
    )

    # Reuse counts produced by processing_pipeline when available.
    use_existing_sentiment_counts = sentiment_counts is not None
    positive_sentiment = 0
    negative_sentiment = 0
    neutral_sentiment = 0

    if use_existing_sentiment_counts:
        positive_sentiment = int(sentiment_counts.get("positive", 0) or 0)
        negative_sentiment = int(sentiment_counts.get("negative", 0) or 0)
        neutral_sentiment = int(sentiment_counts.get("neutral", 0) or 0)

    for segment in segments:
        if not isinstance(segment, dict):
            continue

        text = str(segment.get("text", "")).strip()
        if not text:
            continue

        word_count = len(text.split())
        total_words += word_count

        speaker = str(segment.get("speaker") or "UNKNOWN")

        try:
            start = float(segment.get("start", 0) or 0)
            end = float(segment.get("end", 0) or 0)
            duration = max(0.0, end - start)
        except (TypeError, ValueError):
            duration = 0.0

        speaker_stats[speaker]["speaking_time"] += duration
        speaker_stats[speaker]["word_count"] += word_count

        # Only calculate sentiment here when standalone callers did not
        # already provide counts from the pipeline.
        if not use_existing_sentiment_counts:
            try:
                sentiment = analyze_sentiment(text)
                label = str(sentiment.get("label", "neutral")).lower()

                if label == "positive":
                    positive_sentiment += 1
                elif label == "negative":
                    negative_sentiment += 1
                else:
                    neutral_sentiment += 1
            except Exception as error:
                print(f"Sentiment analysis failed: {error}")
                neutral_sentiment += 1

    speaker_analytics = [
        {
            "speaker": speaker,
            "speaking_time": round(stats["speaking_time"], 2),
            "word_count": stats["word_count"],
        }
        for speaker, stats in speaker_stats.items()
    ]

    speaker_analytics.sort(
        key=lambda item: item["word_count"],
        reverse=True,
    )

    return {
        "total_words": total_words,
        "speaker_count": len(speaker_stats),
        "positive_sentiment": positive_sentiment,
        "negative_sentiment": negative_sentiment,
        "neutral_sentiment": neutral_sentiment,
        "speaker_analytics": speaker_analytics,
    }

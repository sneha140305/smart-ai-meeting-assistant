def calculate_meeting_score(
    total_words: int,
    speaker_count: int,
    positive_sentiment: int,
    negative_sentiment: int,
    neutral_sentiment: int,
    action_items: list,
    duration: int | None = None,
):
    """
    Calculate an explainable meeting effectiveness score.

    Maximum score = 100

    Components:
    - Participation: 25
    - Sentiment: 20
    - Action items: 25
    - Transcript quality: 20
    - Meeting efficiency: 10
    """

    if speaker_count >= 2:
        participation_score = 25
    elif speaker_count == 1:
        participation_score = 12
    else:
        participation_score = 0

    sentiment_total = (
        positive_sentiment
        + negative_sentiment
        + neutral_sentiment
    )

    if sentiment_total == 0:
        sentiment_score = 10
    else:
        positive_ratio = (
            positive_sentiment / sentiment_total
        )

        negative_ratio = (
            negative_sentiment / sentiment_total
        )

       
        sentiment_score = 20 * (
            0.5
            + (positive_ratio * 0.5)
            - (negative_ratio * 0.3)
        )

        sentiment_score = max(
            0,
            min(20, sentiment_score)
        )


    if not action_items:
        action_score = 12
    else:
        completed = sum(
            1
            for item in action_items
            if getattr(item, "status", None) == "completed"
            or (
                isinstance(item, dict)
                and item.get("status") == "completed"
            )
        )

        completion_ratio = (
            completed / len(action_items)
        )

        action_score = 10 + (
            completion_ratio * 15
        )

    if total_words >= 500:
        transcript_score = 20
    elif total_words >= 200:
        transcript_score = 16
    elif total_words >= 50:
        transcript_score = 10
    elif total_words > 0:
        transcript_score = 5
    else:
        transcript_score = 0

    if duration and duration > 0 and total_words > 0:

        words_per_minute = (
            total_words / (duration / 60)
        )

        if 80 <= words_per_minute <= 180:
            efficiency_score = 10
        elif 50 <= words_per_minute <= 220:
            efficiency_score = 7
        else:
            efficiency_score = 5

    else:
        efficiency_score = 5

    score = (
        participation_score
        + sentiment_score
        + action_score
        + transcript_score
        + efficiency_score
    )

    score = round(
        max(0, min(100, score))
    )

    if score >= 85:
        rating = "Excellent"
    elif score >= 70:
        rating = "Good"
    elif score >= 50:
        rating = "Needs Improvement"
    else:
        rating = "Poor"

    return {
        "score": score,
        "rating": rating,
        "breakdown": {
            "participation": round(
                participation_score
            ),
            "sentiment": round(
                sentiment_score
            ),
            "action_items": round(
                action_score
            ),
            "transcript_quality": round(
                transcript_score
            ),
            "efficiency": round(
                efficiency_score
            ),
        },
    }
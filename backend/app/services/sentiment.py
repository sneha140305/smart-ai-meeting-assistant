from transformers import pipeline


_sentiment_model = None


def get_sentiment_model():
    """Load the local sentiment model only when it is first needed."""
    global _sentiment_model

    if _sentiment_model is None:
        _sentiment_model = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
        )

    return _sentiment_model


def analyze_sentiment(text: str):
    """Return positive/negative/neutral sentiment for a text segment."""
    if not text or not text.strip():
        return {"label": "neutral", "score": 0.0}

    model = get_sentiment_model()
    result = model(text[:512])[0]

    label = str(result["label"]).lower()
    score = float(result["score"])

    # The underlying model is binary. Low-confidence predictions are
    # treated as neutral for meeting-level analytics.
    final_label = "neutral" if score < 0.65 else label

    return {
        "label": final_label,
        "score": round(score, 4),
    }
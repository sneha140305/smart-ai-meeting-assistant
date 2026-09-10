from transformers import pipeline


sentiment_model = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english"
)


def analyze_sentiment(text: str):

    if not text or not text.strip():
        return {
            "label": "neutral",
            "score": 0.0
        }

    result = sentiment_model(
        text[:512]
    )[0]

    label = result["label"].lower()
    score = float(result["score"])

    # Low-confidence predictions are treated as neutral.
    if score < 0.65:
        final_label = "neutral"
    else:
        final_label = label

    return {
        "label": final_label,
        "score": round(score, 4)
    }
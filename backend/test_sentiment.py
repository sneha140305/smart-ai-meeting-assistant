from app.services.sentiment import analyze_sentiment


examples = [
    "The project is going really well.",
    "We are facing serious problems with the deployment.",
    "The meeting starts at 10 AM."
]


for text in examples:

    result = analyze_sentiment(text)

    print()
    print("Text:", text)
    print("Sentiment:", result["label"])
    print("Confidence:", result["score"])
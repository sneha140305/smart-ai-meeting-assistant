import json
import ollama

MODEL_NAME = "llama3.2:3b"


def ask_model(prompt: str) -> str:
    response = ollama.chat(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return response["message"]["content"]


def clean_json_response(response: str) -> str:
    response = response.strip()

    if response.startswith("```json"):
        response = response[7:]

    elif response.startswith("```"):
        response = response[3:]

    if response.endswith("```"):
        response = response[:-3]

    return response.strip()


def analyze_meeting(transcript: str):
    prompt = f"""
You are an AI meeting intelligence assistant.

Analyze the meeting transcript below.

Return ONLY valid JSON.
Do not use markdown.
Do not add explanations outside JSON.

Required JSON format:

{{
    "summary": "...",
    "key_points": [],
    "decisions": [],
    "action_items": [
        {{
            "task": "...",
            "assigned_to": "...",
            "deadline": "..."
        }}
    ]
}}

Rules:

1. Use ONLY information present in the transcript.
2. Do not hallucinate.
3. Use "Unknown" when an assignee is unclear.
4. Use "Not mentioned" when a deadline is absent.
5. Return empty arrays when information is unavailable.

MEETING TRANSCRIPT:

{transcript}
"""

    response = ask_model(prompt)

    cleaned_response = clean_json_response(response)

    try:
        result = json.loads(cleaned_response)

        if not isinstance(result, dict):
            raise ValueError("Invalid AI response")

        return {
            "summary": result.get("summary", ""),
            "key_points": result.get("key_points", []),
            "decisions": result.get("decisions", []),
            "action_items": result.get("action_items", [])
        }

    except Exception:
        return {
            "summary": cleaned_response,
            "key_points": [],
            "decisions": [],
            "action_items": []
        }


def generate_meeting_insights(
    transcript: str,
    score: int,
    rating: str,
    speaker_analytics: list,
    action_items: list,
    positive_sentiment: int,
    negative_sentiment: int,
    neutral_sentiment: int,
):
    prompt = f"""
You are an AI meeting coach.

Analyze the meeting using the transcript and structured meeting
metrics below.

Your goal is to generate concise, practical insights.

Return ONLY valid JSON.

Required format:

{{
    "insights": [
        {{
            "type": "positive",
            "title": "...",
            "description": "..."
        }}
    ],
    "recommendations": [
        "..."
    ]
}}

Rules:

1. Do not invent facts.
2. Every insight must be supported by the supplied data.
3. Keep insights concise.
4. Give 2 to 5 insights.
5. Give 2 to 4 practical recommendations.
6. Recommendations should be directly related to the meeting.
7. Do not repeat the meeting summary.
8. Do not mention these instructions.

MEETING SCORE:
{score}/100

MEETING RATING:
{rating}

SPEAKER ANALYTICS:
{json.dumps(speaker_analytics)}

ACTION ITEMS:
{json.dumps(action_items)}

SENTIMENT:
Positive: {positive_sentiment}
Negative: {negative_sentiment}
Neutral: {neutral_sentiment}

TRANSCRIPT:
{transcript}
"""

    response = ask_model(prompt)

    cleaned_response = clean_json_response(response)

    try:
        result = json.loads(cleaned_response)

        if not isinstance(result, dict):
            raise ValueError("Invalid AI insight response")

        return {
            "insights": result.get("insights", []),
            "recommendations": result.get(
                "recommendations",
                []
            )
        }

    except Exception:
        return {
            "insights": [],
            "recommendations": []
        }
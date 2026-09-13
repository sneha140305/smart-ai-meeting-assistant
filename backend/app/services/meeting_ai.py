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
Do not add markdown.
Do not add explanations outside JSON.

Required JSON structure:

{{
    "summary": "A concise but useful summary of the meeting.",

    "key_points": [
        "Important point 1",
        "Important point 2"
    ],

    "decisions": [
        "Decision 1",
        "Decision 2"
    ],

    "action_items": [
        {{
            "task": "Task description",
            "assigned_to": "Person responsible or Unknown",
            "deadline": "Deadline or Not mentioned"
        }}
    ]
}}

Rules:

1. Use ONLY information present in the transcript.
2. Never invent names, tasks, decisions or deadlines.
3. If nobody is clearly assigned to a task, use "Unknown".
4. If no deadline is mentioned, use "Not mentioned".
5. If there are no decisions, return an empty decisions array.
6. If there are no action items, return an empty action_items array.
7. Keep the summary concise.
8. Keep key points factual.
9. Do not hallucinate information.

MEETING TRANSCRIPT:

{transcript}
"""

    response = ask_model(prompt)

    cleaned_response = clean_json_response(response)

    try:
        result = json.loads(cleaned_response)

        if not isinstance(result, dict):
            raise ValueError("AI response is not a JSON object.")

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
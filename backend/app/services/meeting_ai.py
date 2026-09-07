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

def analyze_meeting(transcript: str):

    prompt = f"""
You are an AI meeting assistant.

Analyze the following meeting transcript.

Return ONLY valid JSON.

Required structure:

{{
    "summary": "Short summary of the meeting",
    "key_points": [],
    "decisions": [],
    "action_items": [
        {{
            "task": "",
            "assigned_to": "",
            "deadline": ""
        }}
    ]
}}

Rules:
- Do not invent information.
- Use "Unknown" if an assignee is unclear.
- Use "Not mentioned" if a deadline is absent.
- Only use information from the transcript.

TRANSCRIPT:

{transcript}
"""

    response = ask_model(prompt)

    cleaned_response = response.strip()

    if cleaned_response.startswith("```"):
        cleaned_response = cleaned_response.replace(
            "```json",
            ""
        ).replace(
            "```",
            ""
        ).strip()

    try:
        return json.loads(cleaned_response)

    except json.JSONDecodeError:
        return {
            "summary": cleaned_response,
            "key_points": [],
            "decisions": [],
            "action_items": []
        }
import json

import ollama


MODEL_NAME = "llama3.2:3b"


def ask_model(prompt: str) -> str:
    """
    Send a prompt to the local Ollama model.
    """

    response = ollama.chat(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
    )

    return response["message"]["content"]


def clean_json_response(response: str) -> str:
    """
    Remove markdown code fences if the model
    accidentally wraps the JSON response.
    """

    response = response.strip()

    if response.startswith("```json"):
        response = response[7:]

    elif response.startswith("```"):
        response = response[3:]

    if response.endswith("```"):
        response = response[:-3]

    return response.strip()


def normalize_priority(priority: str) -> str:
    """
    Ensure the AI-generated priority is always
    one of the supported values.
    """

    if not priority:
        return "medium"

    priority = str(priority).lower().strip()

    if priority in ["high", "medium", "low"]:
        return priority

    return "medium"


def analyze_meeting(transcript: str):
    """
    Analyze the meeting transcript and extract:

    - Summary
    - Key points
    - Decisions
    - Action items
    - Assignee
    - Deadline
    - Priority
    """

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
            "deadline": "...",
            "priority": "medium"
        }}
    ]
}}

Rules:

1. Use ONLY information present in the transcript.
2. Do not hallucinate facts.
3. Extract only genuine action items or tasks discussed in the meeting.
4. Use "Unknown" when the assignee is unclear.
5. Use "Not mentioned" when a deadline is absent.
6. Return an empty array when there are no action items.
7. Priority must be exactly one of:
   - "low"
   - "medium"
   - "high"

8. Use "high" priority only when the transcript clearly indicates:
   - urgency,
   - a critical blocker,
   - an important business requirement,
   - an immediate deadline,
   - or a task that is explicitly described as critical/high priority.

9. Use "low" priority when the task is clearly minor or non-urgent.

10. Use "medium" priority as the default when the transcript does not provide
    enough information to determine priority.

11. Do not invent priority from assumptions.

12. Keep action-item tasks concise and specific.

13. If the transcript says something like "Rahul will prepare
    the report by Friday", extract:
    task = "Prepare the report"
    assigned_to = "Rahul"
    deadline = "Friday"

14. If there is no explicit deadline, use:
    "Not mentioned"

15. If there is no clear person responsible, use:
    "Unknown"

MEETING TRANSCRIPT:

{transcript}
"""

    response = ask_model(prompt)

    cleaned_response = clean_json_response(response)

    try:
        result = json.loads(cleaned_response)

        if not isinstance(result, dict):
            raise ValueError("Invalid AI response")

        raw_action_items = result.get(
            "action_items",
            []
        )

        normalized_action_items = []

        if isinstance(raw_action_items, list):

            for item in raw_action_items:

                if not isinstance(item, dict):
                    continue

                task = str(
                    item.get("task", "")
                ).strip()

                if not task:
                    continue

                assigned_to = str(
                    item.get(
                        "assigned_to",
                        "Unknown"
                    )
                ).strip()

                deadline = str(
                    item.get(
                        "deadline",
                        "Not mentioned"
                    )
                ).strip()

                priority = normalize_priority(
                    item.get(
                        "priority",
                        "medium"
                    )
                )

                normalized_action_items.append(
                    {
                        "task": task,
                        "assigned_to": (
                            assigned_to
                            if assigned_to
                            else "Unknown"
                        ),
                        "deadline": (
                            deadline
                            if deadline
                            else "Not mentioned"
                        ),
                        "priority": priority,
                    }
                )

        return {
            "summary": result.get(
                "summary",
                ""
            ),

            "key_points": (
                result.get(
                    "key_points",
                    []
                )
                if isinstance(
                    result.get(
                        "key_points",
                        []
                    ),
                    list
                )
                else []
            ),

            "decisions": (
                result.get(
                    "decisions",
                    []
                )
                if isinstance(
                    result.get(
                        "decisions",
                        []
                    ),
                    list
                )
                else []
            ),

            "action_items": normalized_action_items,
        }

    except Exception as error:

        print(
            f"AI JSON parsing failed: {error}"
        )

        return {
            "summary": cleaned_response,
            "key_points": [],
            "decisions": [],
            "action_items": [],
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
    """
    Generate higher-level AI insights and
    recommendations using existing meeting data.
    """

    prompt = f"""
You are an AI meeting coach.

Analyze the meeting using the transcript and
structured meeting metrics below.

Your goal is to generate concise and practical
meeting insights.

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
4. Generate 2 to 5 insights.
5. Generate 2 to 4 practical recommendations.
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

        result = json.loads(
            cleaned_response
        )

        if not isinstance(result, dict):
            raise ValueError(
                "Invalid AI insight response"
            )

        insights = result.get(
            "insights",
            []
        )

        recommendations = result.get(
            "recommendations",
            []
        )

        if not isinstance(insights, list):
            insights = []

        if not isinstance(
            recommendations,
            list
        ):
            recommendations = []

        return {
            "insights": insights,
            "recommendations": recommendations,
        }

    except Exception as error:

        print(
            f"AI insight parsing failed: {error}"
        )

        return {
            "insights": [],
            "recommendations": [],
        }
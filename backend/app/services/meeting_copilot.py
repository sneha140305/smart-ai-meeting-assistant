import ollama


MODEL_NAME = "llama3.2:3b"


def ask_meeting_copilot(
    transcript: str,
    question: str
) -> str:

    prompt = f"""
You are an AI meeting assistant.

Answer the user's question using ONLY the meeting transcript
provided below.

Do not use outside knowledge.

If the answer is not present in the transcript, clearly say:
"I couldn't find that information in this meeting."

Do not invent names, dates, decisions, tasks, or facts.

Keep the answer concise and directly answer the question.

MEETING TRANSCRIPT:
-------------------
{transcript}
-------------------

USER QUESTION:
{question}

ANSWER:
"""

    response = ollama.chat(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return response["message"]["content"].strip()
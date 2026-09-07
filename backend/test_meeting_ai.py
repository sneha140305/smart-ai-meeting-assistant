from app.services.meeting_ai import analyze_meeting


transcript = """
SPEAKER_00: Good morning everyone. We need to finalize
the project launch date.

SPEAKER_01: I suggest September 15.

SPEAKER_00: That works for me.

SPEAKER_01: Rahul, please prepare the deployment
checklist by September 10.

SPEAKER_02: I'll finalize the marketing material
by September 8.

SPEAKER_00: Great. Let's proceed with September 15.
"""


result = analyze_meeting(transcript)

print("\nSUMMARY")
print(result["summary"])

print("\nKEY POINTS")

for point in result["key_points"]:
    print("-", point)


print("\nDECISIONS")

for decision in result["decisions"]:
    print("-", decision)


print("\nACTION ITEMS")

for item in result["action_items"]:
    print(
        f"- {item['task']} | "
        f"{item['assigned_to']} | "
        f"{item['deadline']}"
    )
from app.services.audio_processor import extract_audio


INPUT_FILE = "backend/uploads/ElevenLabs_2026-09-02T10_38_57_Roger - Laid-Back, Casual, Resonant_pre_sp100_s50_sb75_se0_b_m2.mp3"


try:
    output_file = extract_audio(
        INPUT_FILE,
        meeting_id=999
    )

    print("Audio processing successful!")
    print(f"Output file: {output_file}")

except Exception as error:
    print("Audio processing failed.")
    print(error)
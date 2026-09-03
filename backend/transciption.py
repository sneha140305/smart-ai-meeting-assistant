from app.services.transcription import transcribe_audio


AUDIO_FILE = "processed_audio/meeting_999.wav"


try:
    result = transcribe_audio(AUDIO_FILE)

    print("\nDetected language:")
    print(result["language"])

    print("\nTranscript:")
    print("-" * 60)

    for segment in result["segments"]:
        print(
            f"[{segment['start']:.2f}s - "
            f"{segment['end']:.2f}s] "
            f"{segment['text']}"
        )

except Exception as error:
    print("Transcription failed.")
    print(error)
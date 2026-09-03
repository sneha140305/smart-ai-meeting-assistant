from app.services.diarization import diarize_audio


audio_path = "processed_audio/meeting_1.wav"

print("Starting speaker diarization...")

try:
    speaker_segments = diarize_audio(audio_path)

    print("\nSpeaker segments:\n")

    for segment in speaker_segments:
        print(
            f"[{segment['start']:.2f}s - "
            f"{segment['end']:.2f}s] "
            f"{segment['speaker']}"
        )

except Exception as e:
    print("Diarization failed.")
    print(e)
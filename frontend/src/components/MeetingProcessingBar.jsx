const stageLabels = {
  transcription: "Converting speech to text...",
  speaker_identification: "Identifying speakers...",
  sentiment: "Analyzing meeting sentiment...",
  ai_analysis: "Analyzing meeting with AI...",
  analytics: "Calculating meeting analytics...",
  insights: "Generating AI insights...",
  report: "Generating meeting report...",
  completed: "Processing complete",
  failed: "Processing failed",
};

export default function MeetingProcessingBar({ meeting }) {
  const status = meeting?.status;

  const progress = Math.min(
    Math.max(meeting?.processing_progress ?? 0, 0),
    100
  );

  const stage = meeting?.processing_stage;

  const message =
    meeting?.processing_message ||
    stageLabels[stage] ||
    "Preparing meeting...";

  // Completed state
  if (status === "completed") {
    return (
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-green-600">
            ✓ Processing complete
          </span>

          <span className="text-xs font-medium text-green-600">
            100%
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-green-100">
          <div
            className="h-full w-full rounded-full bg-green-500"
            style={{
              width: "100%",
            }}
          />
        </div>
      </div>
    );
  }

  // Failed state
  if (
    status === "processing_failed" ||
    status === "analysis_failed"
  ) {
    return (
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-red-600">
            ✕ Processing failed
          </span>

          <span className="text-xs font-medium text-red-600">
            Failed
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-100">
          <div
            className="h-full w-full rounded-full bg-red-500"
            style={{
              width: "100%",
            }}
          />
        </div>

        {meeting?.processing_error && (
          <p className="mt-1 text-xs text-red-500">
            {meeting.processing_error}
          </p>
        )}
      </div>
    );
  }

  // Processing state
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="truncate text-xs text-gray-500">
          {message}
        </span>

        <span className="shrink-0 text-xs font-medium text-gray-600">
          {progress}%
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
    </div>
  );
}
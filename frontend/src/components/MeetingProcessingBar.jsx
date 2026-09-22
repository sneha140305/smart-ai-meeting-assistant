const progressMap = {
  processing: 10,
  transcribing: 30,
  diarizing: 55,
  analyzing: 80,
  completed: 100,
  processing_failed: 100,
  analysis_failed: 100
};

const labelMap = {
  processing: "Preparing meeting...",
  transcribing: "Converting speech to text...",
  diarizing: "Identifying speakers...",
  analyzing: "Generating AI insights...",
  completed: "Processing complete",
  processing_failed: "Processing failed",
  analysis_failed: "Analysis failed"
};

export default function MeetingProcessingBar({ status }) {
  const progress = progressMap[status] ?? 0;
  const label = labelMap[status] ?? "Waiting...";

  if (status === "completed") {
    return null;
  }

  if (
    status === "processing_failed" ||
    status === "analysis_failed"
  ) {
    return (
      <div className="mt-3">
        <p className="mb-1 text-xs text-red-600">
          {label}
        </p>

        <div className="h-1.5 overflow-hidden rounded-full bg-red-100">
          <div className="h-full w-full bg-red-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">

      <div className="mb-1 flex justify-between">
        <span className="text-xs text-gray-500">
          {label}
        </span>

        <span className="text-xs font-medium text-gray-600">
          {progress}%
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">

        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-700"
          style={{
            width: `${progress}%`
          }}
        />

      </div>

    </div>
  );
}
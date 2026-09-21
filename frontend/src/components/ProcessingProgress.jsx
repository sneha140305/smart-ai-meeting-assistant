import {
  Upload,
  Mic,
  Users,
  Brain,
  CheckCircle,
  Loader2,
  AlertCircle
} from "lucide-react";

const steps = [
  {
    status: "processing",
    label: "Preparing Meeting",
    icon: Upload
  },
  {
    status: "transcribing",
    label: "Transcribing Audio",
    icon: Mic
  },
  {
    status: "diarizing",
    label: "Identifying Speakers",
    icon: Users
  },
  {
    status: "analyzing",
    label: "Analyzing with AI",
    icon: Brain
  },
  {
    status: "completed",
    label: "Processing Complete",
    icon: CheckCircle
  }
];

const statusOrder = {
  processing: 0,
  transcribing: 1,
  diarizing: 2,
  analyzing: 3,
  completed: 4
};

export default function ProcessingProgress({ status }) {

  const currentStep =
    statusOrder[status] ?? 0;

  const failed =
    status === "processing_failed" ||
    status === "analysis_failed";

  if (failed) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-600" />

          <div>
            <h3 className="font-semibold text-red-800">
              Processing Failed
            </h3>

            <p className="text-sm text-red-600">
              Something went wrong while processing this meeting.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">

      <div className="mb-6">
        <h3 className="text-lg font-semibold">
          AI Processing
        </h3>

        <p className="text-sm text-gray-500">
          Your meeting is being processed automatically.
        </p>
      </div>

      <div className="space-y-5">

        {steps.map((step, index) => {

          const Icon = step.icon;

          const isCompleted =
            currentStep > index;

          const isCurrent =
            currentStep === index;

          return (
            <div
              key={step.status}
              className="flex items-center gap-4"
            >

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isCompleted
                    ? "bg-green-100 text-green-600"
                    : isCurrent
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >

                {isCurrent &&
                status !== "completed" ? (
                  <Loader2
                    size={20}
                    className="animate-spin"
                  />
                ) : (
                  <Icon size={20} />
                )}

              </div>

              <div>
                <p
                  className={`font-medium ${
                    isCurrent
                      ? "text-blue-700"
                      : isCompleted
                      ? "text-green-700"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </p>

                {isCurrent && (
                  <p className="text-xs text-gray-500">
                    In progress...
                  </p>
                )}
              </div>

            </div>
          );
        })}

      </div>

      <div className="mt-6">

        <div className="mb-2 flex justify-between text-xs text-gray-500">
          <span>Progress</span>

          <span>
            {status === "completed"
              ? "100%"
              : `${Math.min(
                  95,
                  ((currentStep + 1) / steps.length) * 100
                ).toFixed(0)}%`}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-gray-100">

          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-500"
            style={{
              width:
                status === "completed"
                  ? "100%"
                  : `${Math.min(
                      95,
                      ((currentStep + 1) / steps.length) * 100
                    )}%`
            }}
          />

        </div>

      </div>

    </div>
  );
}
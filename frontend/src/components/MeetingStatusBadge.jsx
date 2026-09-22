import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Mic,
  Users,
  Brain,
  Clock
} from "lucide-react";

const statusConfig = {
  processing: {
    label: "Preparing",
    className: "bg-yellow-100 text-yellow-700",
    icon: Clock
  },

  audio_ready: {
    label: "Ready",
    className: "bg-blue-100 text-blue-700",
    icon: Clock
  },

  transcribing: {
    label: "Transcribing",
    className: "bg-purple-100 text-purple-700",
    icon: Mic
  },

  diarizing: {
    label: "Identifying Speakers",
    className: "bg-indigo-100 text-indigo-700",
    icon: Users
  },

  analyzing: {
    label: "AI Analyzing",
    className: "bg-orange-100 text-orange-700",
    icon: Brain
  },

  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-700",
    icon: CheckCircle
  },

  processing_failed: {
    label: "Processing Failed",
    className: "bg-red-100 text-red-700",
    icon: AlertCircle
  },

  analysis_failed: {
    label: "Analysis Failed",
    className: "bg-red-100 text-red-700",
    icon: AlertCircle
  }
};

export default function MeetingStatusBadge({ status }) {
  const config =
    statusConfig[status] || {
      label: status || "Unknown",
      className: "bg-gray-100 text-gray-600",
      icon: Clock
    };

  const Icon = config.icon;

  const isProcessing = [
    "processing",
    "transcribing",
    "diarizing",
    "analyzing"
  ].includes(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.className}`}
    >
      {isProcessing ? (
        <Loader2
          size={13}
          className="animate-spin"
        />
      ) : (
        <Icon size={13} />
      )}

      {config.label}
    </span>
  );
}
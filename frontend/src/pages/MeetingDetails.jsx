import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileAudio,
  Loader2,
  Search,
  User,
  CalendarDays,
  Users,
  MessageSquareText,
  BarChart3,
  Brain,
  ListChecks,
  Play,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";

function formatTimestamp(seconds) {
  const totalSeconds = Math.floor(Number(seconds) || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatStatus(status) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function highlightText(text, query) {
  if (!query.trim()) {
    return text;
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));

  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return (
        <mark
          key={index}
          className="rounded bg-yellow-200 px-1 text-slate-900"
        >
          {part}
        </mark>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function StatusBadge({ status }) {
  const styles = {
    completed: "bg-green-100 text-green-700 border-green-200",
    processing: "bg-blue-100 text-blue-700 border-blue-200",
    preprocessing: "bg-blue-100 text-blue-700 border-blue-200",
    audio_ready: "bg-purple-100 text-purple-700 border-purple-200",
    transcribing: "bg-indigo-100 text-indigo-700 border-indigo-200",
    transcribed: "bg-indigo-100 text-indigo-700 border-indigo-200",
    diarizing: "bg-orange-100 text-orange-700 border-orange-200",
    analyzing: "bg-pink-100 text-pink-700 border-pink-200",
    analysis_failed: "bg-red-100 text-red-700 border-red-200",
    diarization_failed: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
        styles[status] || "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>

          {description && (
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          )}
        </div>

        <div className="rounded-xl bg-slate-100 p-3">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
    </div>
  );
}

export default function MeetingDetails() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [actionItems, setActionItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("ALL");

  const [updatingActionItem, setUpdatingActionItem] = useState(null);

  useEffect(() => {
    loadMeetingData();
  }, [meetingId]);

  async function loadMeetingData() {
    try {
      setLoading(true);
      setError("");

      const meetingResponse = await api.get(`/meetings/${meetingId}`);
      setMeeting(meetingResponse.data);

      try {
        const transcriptResponse = await api.get(
          `/meetings/${meetingId}/transcript`
        );
        setTranscript(transcriptResponse.data);
      } catch (transcriptError) {
        setTranscript(null);
      }

      try {
        const actionItemsResponse = await api.get(
          `/meetings/${meetingId}/action-items`
        );
        setActionItems(actionItemsResponse.data || []);
      } catch (actionItemsError) {
        setActionItems([]);
      }
    } catch (err) {
      console.error("Failed to load meeting:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to load meeting details."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runTranscription() {
    try {
      setProcessing(true);
      setError("");
      setSuccessMessage("");

      await api.post(`/meetings/${meetingId}/transcribe`);

      setSuccessMessage("Transcription completed successfully.");

      await loadMeetingData();
    } catch (err) {
      console.error("Transcription failed:", err);

      setError(
        err.response?.data?.detail ||
          "Transcription failed. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function runDiarization() {
    try {
      setProcessing(true);
      setError("");
      setSuccessMessage("");

      await api.post(`/meetings/${meetingId}/diarize`);

      setSuccessMessage("Speaker diarization completed successfully.");

      await loadMeetingData();
    } catch (err) {
      console.error("Diarization failed:", err);

      setError(
        err.response?.data?.detail ||
          "Speaker diarization failed. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function runAnalysis() {
    try {
      setProcessing(true);
      setError("");
      setSuccessMessage("");

      await api.post(`/meetings/${meetingId}/analyze`);

      setSuccessMessage("AI meeting analysis completed successfully.");

      await loadMeetingData();
    } catch (err) {
      console.error("Analysis failed:", err);

      setError(
        err.response?.data?.detail ||
          "AI analysis failed. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function refreshData() {
    setSuccessMessage("");
    await loadMeetingData();
  }

  async function updateActionItemStatus(actionItemId, status) {
    try {
      setUpdatingActionItem(actionItemId);
      setError("");
      setSuccessMessage("");

      await api.patch(
        `/meetings/${meetingId}/action-items/${actionItemId}`,
        null,
        {
          params: {
            status,
          },
        }
      );

      setActionItems((currentItems) =>
        currentItems.map((item) =>
          item.id === actionItemId
            ? {
                ...item,
                status,
              }
            : item
        )
      );

      setSuccessMessage("Action item status updated.");
    } catch (err) {
      console.error("Failed to update action item:", err);

      setError(
        err.response?.data?.detail ||
          "Failed to update action item."
      );
    } finally {
      setUpdatingActionItem(null);
    }
  }

  const hasTranscript =
    transcript &&
    Array.isArray(transcript.segments) &&
    transcript.segments.length > 0;

  const speakers = useMemo(() => {
    if (!hasTranscript) {
      return [];
    }

    return [
      ...new Set(
        transcript.segments.map(
          (segment) => segment.speaker || "UNKNOWN"
        )
      ),
    ];
  }, [hasTranscript, transcript]);

  const filteredSegments = useMemo(() => {
    if (!hasTranscript) {
      return [];
    }

    const query = searchQuery.trim().toLowerCase();

    return transcript.segments.filter((segment) => {
      const text = segment.text?.toLowerCase() || "";
      const speaker = segment.speaker || "UNKNOWN";

      const matchesSearch =
        !query || text.includes(query);

      const matchesSpeaker =
        selectedSpeaker === "ALL" ||
        speaker === selectedSpeaker;

      return matchesSearch && matchesSpeaker;
    });
  }, [
    hasTranscript,
    transcript,
    searchQuery,
    selectedSpeaker,
  ]);

  const parsedKeyPoints = useMemo(() => {
    if (!meeting?.key_points) {
      return [];
    }

    try {
      const parsed = JSON.parse(meeting.key_points);

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [meeting]);

  const parsedDecisions = useMemo(() => {
    if (!meeting?.decisions) {
      return [];
    }

    try {
      const parsed = JSON.parse(meeting.decisions);

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [meeting]);

  const completedActionItems = actionItems.filter(
    (item) => item.status === "completed"
  ).length;

  const actionCompletionRate =
    actionItems.length > 0
      ? Math.round(
          (completedActionItems / actionItems.length) * 100
        )
      : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading meeting...</span>
        </div>
      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => navigate("/dashboard")}
            className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {meeting?.title || "Untitled Meeting"}
                  </h1>

                  <StatusBadge status={meeting?.status} />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <FileAudio className="h-4 w-4" />
                    {meeting?.file_name || "Audio file"}
                  </span>

                  {meeting?.duration && (
                    <span>
                      Duration:{" "}
                      {Math.floor(meeting.duration / 60)}m{" "}
                      {meeting.duration % 60}s
                    </span>
                  )}

                  {meeting?.created_at && (
                    <span>
                      {new Date(
                        meeting.created_at
                      ).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshData}
                disabled={loading || processing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {/* Processing Actions */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Meeting Processing
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Process the recording through transcription,
              speaker identification, and AI analysis.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={runTranscription}
              disabled={
                processing ||
                !["audio_ready", "transcribed", "diarization_failed"].includes(
                  meeting?.status
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}

              Transcribe
            </button>

            <button
              onClick={runDiarization}
              disabled={
                processing ||
                !["transcribed"].includes(meeting?.status) ||
                !hasTranscript
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Users className="h-4 w-4" />
              Identify Speakers
            </button>

            <button
              onClick={runAnalysis}
              disabled={
                processing ||
                !hasTranscript ||
                !["transcribed", "completed"].includes(
                  meeting?.status
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Brain className="h-4 w-4" />
              Run AI Analysis
            </button>
          </div>

          {processing && (
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing meeting...
            </div>
          )}
        </section>

        {/* KPI Cards */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={MessageSquareText}
            label="Total Words"
            value={
              meeting?.total_words ??
              (hasTranscript
                ? transcript.segments
                    .map((segment) => segment.text || "")
                    .join(" ")
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean).length
                : 0)
            }
            description="Words detected in transcript"
          />

          <StatCard
            icon={Users}
            label="Speakers"
            value={
              meeting?.speaker_count ??
              speakers.length
            }
            description="Unique speakers identified"
          />

          <StatCard
            icon={ListChecks}
            label="Action Items"
            value={actionItems.length}
            description={`${completedActionItems} completed`}
          />

          <StatCard
            icon={BarChart3}
            label="Completion"
            value={`${actionCompletionRate}%`}
            description="Action item completion"
          />
        </section>

        {/* AI Summary */}
        {meeting?.summary && (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-indigo-100 p-3">
                <Brain className="h-5 w-5 text-indigo-600" />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  AI Meeting Summary
                </h2>

                <p className="text-sm text-slate-500">
                  Automatically generated meeting intelligence
                </p>
              </div>
            </div>

            <p className="leading-7 text-slate-700">
              {meeting.summary}
            </p>
          </section>
        )}

        {/* Key Points + Decisions */}
        {(parsedKeyPoints.length > 0 ||
          parsedDecisions.length > 0) && (
          <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {parsedKeyPoints.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-blue-100 p-3">
                    <MessageSquareText className="h-5 w-5 text-blue-600" />
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Key Points
                    </h2>

                    <p className="text-sm text-slate-500">
                      Important topics discussed
                    </p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {parsedKeyPoints.map((point, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />

                      <span className="leading-6 text-slate-700">
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsedDecisions.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-green-100 p-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Decisions
                    </h2>

                    <p className="text-sm text-slate-500">
                      Decisions made during the meeting
                    </p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {parsedDecisions.map((decision, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-green-600" />

                      <span className="leading-6 text-slate-700">
                        {decision}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Action Items */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-100 p-3">
                  <ListChecks className="h-5 w-5 text-amber-600" />
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Action Items
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Tasks identified from the meeting
                  </p>
                </div>
              </div>
            </div>

            <div className="text-sm text-slate-500">
              {completedActionItems}/{actionItems.length} completed
            </div>
          </div>

          {actionItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center">
              <ListChecks className="mx-auto h-8 w-8 text-slate-300" />

              <p className="mt-3 text-sm font-medium text-slate-600">
                No action items found
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Run AI analysis to extract tasks from the meeting.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-4 transition hover:shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3">
                      <div className="mt-1">
                        {item.status === "completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock3 className="h-5 w-5 text-amber-500" />
                        )}
                      </div>

                      <div>
                        <p
                          className={`font-medium ${
                            item.status === "completed"
                              ? "text-slate-400 line-through"
                              : "text-slate-900"
                          }`}
                        >
                          {item.task || "Untitled task"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <User className="h-4 w-4" />

                            {item.assigned_to || "Unknown"}
                          </span>

                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4" />

                            {item.deadline || "Not mentioned"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {updatingActionItem === item.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      )}

                      <select
                        value={item.status || "pending"}
                        disabled={updatingActionItem === item.id}
                        onChange={(event) =>
                          updateActionItemStatus(
                            item.id,
                            event.target.value
                          )
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="pending">
                          Pending
                        </option>

                        <option value="in_progress">
                          In Progress
                        </option>

                        <option value="completed">
                          Completed
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Analytics */}
        {(meeting?.positive_sentiment != null ||
          meeting?.negative_sentiment != null ||
          meeting?.neutral_sentiment != null ||
          meeting?.speaker_count != null) && (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-purple-100 p-3">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Meeting Analytics
                </h2>

                <p className="text-sm text-slate-500">
                  Conversation and sentiment insights
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                <p className="text-sm font-medium text-green-700">
                  Positive
                </p>

                <p className="mt-2 text-3xl font-bold text-green-800">
                  {meeting?.positive_sentiment ?? 0}
                </p>

                <p className="mt-1 text-xs text-green-600">
                  Positive transcript segments
                </p>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                <p className="text-sm font-medium text-red-700">
                  Negative
                </p>

                <p className="mt-2 text-3xl font-bold text-red-800">
                  {meeting?.negative_sentiment ?? 0}
                </p>

                <p className="mt-1 text-xs text-red-600">
                  Negative transcript segments
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-600">
                  Neutral
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-800">
                  {meeting?.neutral_sentiment ?? 0}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Neutral transcript segments
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Speaker Analytics */}
        {meeting?.speaker_analytics &&
          Array.isArray(meeting.speaker_analytics) &&
          meeting.speaker_analytics.length > 0 && (
            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-blue-100 p-3">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Speaker Analytics
                  </h2>

                  <p className="text-sm text-slate-500">
                    Participation breakdown
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Speaker
                      </th>

                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Speaking Time
                      </th>

                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Words
                      </th>

                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Percentage
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {meeting.speaker_analytics.map(
                      (speaker, index) => (
                        <tr
                          key={index}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {speaker.speaker || "UNKNOWN"}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {formatTimestamp(
                              speaker.speaking_time
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {speaker.word_count ?? 0}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {speaker.percentage != null
                              ? `${speaker.percentage}%`
                              : "—"}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

        {/* Transcript */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-3">
                  <MessageSquareText className="h-5 w-5 text-slate-700" />
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Transcript
                  </h2>

                  <p className="text-sm text-slate-500">
                    Search and filter the meeting conversation
                  </p>
                </div>
              </div>

              {hasTranscript && (
                <div className="text-sm text-slate-500">
                  Showing {filteredSegments.length} of{" "}
                  {transcript.segments.length} segments
                </div>
              )}
            </div>
          </div>

          {!hasTranscript ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
              <MessageSquareText className="mx-auto h-10 w-10 text-slate-300" />

              <p className="mt-4 font-medium text-slate-600">
                No transcript available
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Transcribe the meeting to generate its transcript.
              </p>
            </div>
          ) : (
            <>
              {/* Search / Filters */}
              <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                    placeholder="Search transcript..."
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <select
                  value={selectedSpeaker}
                  onChange={(event) =>
                    setSelectedSpeaker(event.target.value)
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="ALL">
                    All Speakers
                  </option>

                  {speakers.map((speaker) => (
                    <option key={speaker} value={speaker}>
                      {speaker}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active filters */}
              {(searchQuery || selectedSpeaker !== "ALL") && (
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    Active filters:
                  </span>

                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200"
                    >
                      Search: {searchQuery} ×
                    </button>
                  )}

                  {selectedSpeaker !== "ALL" && (
                    <button
                      onClick={() =>
                        setSelectedSpeaker("ALL")
                      }
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Speaker: {selectedSpeaker} ×
                    </button>
                  )}
                </div>
              )}

              {/* Transcript segments */}
              {filteredSegments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center">
                  <Search className="mx-auto h-8 w-8 text-slate-300" />

                  <p className="mt-3 text-sm font-medium text-slate-600">
                    No matching transcript segments
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Try a different search term or speaker.
                  </p>
                </div>
              ) : (
                <div className="max-h-[650px] space-y-2 overflow-y-auto pr-2">
                  {filteredSegments.map((segment, index) => {
                    const speaker =
                      segment.speaker || "UNKNOWN";

                    const text = segment.text || "";

                    return (
                      <div
                        key={`${segment.start}-${index}`}
                        className="group rounded-xl border border-slate-100 p-4 transition hover:border-slate-200 hover:bg-slate-50"
                      >
                        <div className="flex gap-4">
                          <button
                            onClick={() => {
                              const element =
                                document.getElementById(
                                  `transcript-${index}`
                                );

                              element?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                            }}
                            className="mt-0.5 shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
                            title="Jump to timestamp"
                          >
                            {formatTimestamp(segment.start)}
                          </button>

                          <div
                            id={`transcript-${index}`}
                            className="min-w-0 flex-1"
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                <User className="h-3 w-3" />
                                {speaker}
                              </span>

                              <span className="text-xs text-slate-400">
                                {formatTimestamp(segment.start)} –{" "}
                                {formatTimestamp(segment.end)}
                              </span>
                            </div>

                            <p className="leading-7 text-slate-700">
                              {highlightText(
                                text,
                                searchQuery
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

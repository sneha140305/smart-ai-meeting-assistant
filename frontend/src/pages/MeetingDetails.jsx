import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquareText,
  Play,
  RefreshCw,
  Search,
  TrendingUp,
  User,
  Users,
  Video,
} from "lucide-react";

import api from "../services/api";

function MeetingDetails() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [speakerAnalytics, setSpeakerAnalytics] = useState([]);

  const [analytics, setAnalytics] = useState(null);
  const [meetingScore, setMeetingScore] = useState(null);
  const [insights, setInsights] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("all");

  const parseJson = (value, fallback = []) => {
    if (!value) return fallback;

    if (Array.isArray(value)) {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const fetchMeeting = async () => {
    try {
      const response = await api.get(
        `/meetings/${meetingId}`
      );

      setMeeting(response.data);

      setAnalytics({
        totalWords: response.data.total_words || 0,
        speakerCount: response.data.speaker_count || 0,
        positive: response.data.positive_sentiment || 0,
        negative: response.data.negative_sentiment || 0,
        neutral: response.data.neutral_sentiment || 0,
      });

      if (
        response.data.effectiveness_score !== null &&
        response.data.effectiveness_score !== undefined
      ) {
        setMeetingScore({
          score: response.data.effectiveness_score,
          rating:
            response.data.effectiveness_rating ||
            "Not available",
        });
      }

      setInsights(
        parseJson(
          response.data.meeting_insights
        )
      );

      setRecommendations(
        parseJson(
          response.data.meeting_recommendations
        )
      );
    } catch (err) {
      console.error(
        "Failed to fetch meeting:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Failed to load meeting."
      );
    }
  };

  const fetchTranscript = async () => {
    try {
      const response = await api.get(
        `/meetings/${meetingId}/transcript`
      );

      const data = response.data;

      let segments = [];

      if (Array.isArray(data.segments)) {
        segments = data.segments;
      } else if (typeof data.segments === "string") {
        segments = parseJson(data.segments);
      }

      setTranscript({
        ...data,
        segments,
      });
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error(
          "Failed to fetch transcript:",
          err
        );
      }

      setTranscript(null);
    }
  };

  const fetchActionItems = async () => {
    try {
      const response = await api.get(
        `/meetings/${meetingId}/action-items`
      );

      setActionItems(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (err) {
      console.error(
        "Failed to fetch action items:",
        err
      );

      setActionItems([]);
    }
  };

  const fetchSpeakerAnalytics = async () => {
    try {
      const response = await api.get(
        `/meetings/${meetingId}/speaker-analytics`
      );

      setSpeakerAnalytics(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (err) {
      console.error(
        "Failed to fetch speaker analytics:",
        err
      );

      setSpeakerAnalytics([]);
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError("");

      await fetchMeeting();
      await fetchTranscript();
      await fetchActionItems();
      await fetchSpeakerAnalytics();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [meetingId]);

  const transcribeMeeting = async () => {
    try {
      setProcessing(true);
      setError("");

      await api.post(
        `/meetings/${meetingId}/transcribe`
      );

      await fetchMeeting();
      await fetchTranscript();
    } catch (err) {
      console.error(
        "Transcription failed:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Transcription failed."
      );
    } finally {
      setProcessing(false);
    }
  };

  const diarizeMeeting = async () => {
    try {
      setProcessing(true);
      setError("");

      await api.post(
        `/meetings/${meetingId}/diarize`
      );

      await fetchMeeting();
      await fetchTranscript();
    } catch (err) {
      console.error(
        "Diarization failed:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Speaker identification failed."
      );
    } finally {
      setProcessing(false);
    }
  };

  const analyzeMeeting = async () => {
    try {
      setProcessing(true);
      setError("");

      const response = await api.post(
        `/meetings/${meetingId}/analyze`
      );

      const data = response.data;

      if (data.meeting_score) {
        setMeetingScore(
          data.meeting_score
        );
      }

      setInsights(
        data.insights || []
      );

      setRecommendations(
        data.recommendations || []
      );

      await fetchMeeting();
      await fetchActionItems();
      await fetchSpeakerAnalytics();
    } catch (err) {
      console.error(
        "Meeting analysis failed:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Meeting analysis failed."
      );
    } finally {
      setProcessing(false);
    }
  };

  const updateActionItemStatus = async (
    actionItemId,
    status
  ) => {
    try {
      await api.patch(
        `/meetings/${meetingId}/action-items/${actionItemId}`,
        null,
        {
          params: {
            status,
          },
        }
      );

      await fetchActionItems();
    } catch (err) {
      console.error(
        "Failed to update action item:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Failed to update action item."
      );
    }
  };

  const updateActionItemPriority = async (
    actionItemId,
    priority
  ) => {
    try {
      await api.patch(
        `/meetings/${meetingId}/action-items/${actionItemId}`,
        null,
        {
          params: {
            priority,
          },
        }
      );

      await fetchActionItems();
    } catch (err) {
      console.error(
        "Failed to update priority:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Failed to update priority."
      );
    }
  };

  const downloadReport = async () => {
    try {
      setDownloadingReport(true);

      const response = await api.get(
        `/meetings/${meetingId}/report`,
        {
          responseType: "blob",
        }
      );

      const blob = new Blob(
        [response.data],
        {
          type: "application/pdf",
        }
      );

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `meeting_report_${meetingId}.pdf`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(
        "Report download failed:",
        err
      );

      setError(
        "Unable to generate meeting report."
      );
    } finally {
      setDownloadingReport(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return "Unknown date";
    }

    return new Date(
      dateString
    ).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const formatDuration = (duration) => {
    if (!duration) {
      return "Unavailable";
    }

    const totalSeconds =
      Number(duration);

    const minutes =
      Math.floor(
        totalSeconds / 60
      );

    const seconds =
      totalSeconds % 60;

    return `${minutes}m ${String(
      seconds
    ).padStart(2, "0")}s`;
  };

  const formatTimestamp = (seconds) => {
    if (
      seconds === null ||
      seconds === undefined
    ) {
      return "0:00";
    }

    const totalSeconds =
      Math.floor(Number(seconds));

    const minutes =
      Math.floor(
        totalSeconds / 60
      );

    const remaining =
      totalSeconds % 60;

    return `${minutes}:${String(
      remaining
    ).padStart(2, "0")}`;
  };

  const getStatusClass = (status) => {
    if (status === "completed") {
      return "bg-green-50 text-green-700 border-green-200";
    }

    if (
      [
        "processing",
        "preprocessing",
        "audio_ready",
        "transcribing",
        "diarizing",
        "analyzing",
      ].includes(status)
    ) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }

    if (
      [
        "analysis_failed",
        "diarization_failed",
      ].includes(status)
    ) {
      return "bg-red-50 text-red-700 border-red-200";
    }

    return "bg-slate-50 text-slate-600 border-slate-200";
  };

  const getStatusLabel = (status) => {
    const labels = {
      completed: "Completed",
      processing: "Processing",
      preprocessing: "Preparing",
      audio_ready: "Audio Ready",
      transcribing: "Transcribing",
      diarizing: "Identifying Speakers",
      analyzing: "Analyzing",
      analysis_failed: "Analysis Failed",
      diarization_failed:
        "Diarization Failed",
    };

    return (
      labels[status] ||
      status ||
      "Unknown"
    );
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-50 text-red-700 border-red-200";

      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200";

      case "low":
        return "bg-green-50 text-green-700 border-green-200";

      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const isOverdue = (item) => {
    if (
      !item.deadline ||
      item.deadline === "Not mentioned" ||
      item.status === "completed"
    ) {
      return false;
    }

    const deadlineDate =
      new Date(item.deadline);

    if (
      Number.isNaN(
        deadlineDate.getTime()
      )
    ) {
      return false;
    }

    return deadlineDate < new Date();
  };

  const getSentimentPercentage = (
    value
  ) => {
    const total =
      (analytics?.positive || 0) +
      (analytics?.negative || 0) +
      (analytics?.neutral || 0);

    if (!total) {
      return 0;
    }

    return Math.round(
      (value / total) * 100
    );
  };

  const getSpeakerPercentage = (
    wordCount
  ) => {
    const totalWords =
      speakerAnalytics.reduce(
        (total, speaker) =>
          total +
          (speaker.word_count || 0),
        0
      );

    if (!totalWords) {
      return 0;
    }

    return Math.round(
      ((wordCount || 0) /
        totalWords) *
        100
    );
  };

  const completedActionItems =
    actionItems.filter(
      (item) =>
        item.status === "completed"
    ).length;

  const pendingActionItems =
    actionItems.filter(
      (item) =>
        item.status === "pending"
    ).length;

  const inProgressActionItems =
    actionItems.filter(
      (item) =>
        item.status === "in_progress"
    ).length;

  const overdueActionItems =
    actionItems.filter(
      (item) =>
        isOverdue(item)
    ).length;

  const actionCompletionRate =
    actionItems.length
      ? Math.round(
          (completedActionItems /
            actionItems.length) *
            100
        )
      : 0;

  const dominantSpeaker =
    speakerAnalytics.length
      ? [...speakerAnalytics].sort(
          (a, b) =>
            (b.word_count || 0) -
            (a.word_count || 0)
        )[0]
      : null;

  const speakers = useMemo(() => {
    if (
      !transcript ||
      !Array.isArray(
        transcript.segments
      )
    ) {
      return [];
    }

    return [
      ...new Set(
        transcript.segments.map(
          (segment) =>
            segment.speaker ||
            "UNKNOWN"
        )
      ),
    ];
  }, [transcript]);

  const filteredSegments = useMemo(() => {
    if (
      !transcript ||
      !Array.isArray(
        transcript.segments
      )
    ) {
      return [];
    }

    const query =
      searchQuery
        .toLowerCase()
        .trim();

    return transcript.segments.filter(
      (segment) => {
        const text =
          segment.text?.toLowerCase() ||
          "";

        const speaker =
          segment.speaker ||
          "UNKNOWN";

        const matchesSearch =
          !query ||
          text.includes(query);

        const matchesSpeaker =
          selectedSpeaker === "ALL" ||
          speaker === selectedSpeaker;

        return (
          matchesSearch &&
          matchesSpeaker
        );
      }
    );
  }, [
    transcript,
    searchQuery,
    selectedSpeaker,
  ]);

  const filteredActionItems =
    actionItems.filter(
      (item) => {
        if (
          actionFilter === "all"
        ) {
          return true;
        }

        if (
          actionFilter ===
          "overdue"
        ) {
          return isOverdue(item);
        }

        return (
          item.status ===
          actionFilter
        );
      }
    );

  const highlightText = (
    text
  ) => {
    if (!searchQuery.trim()) {
      return text;
    }

    const escaped =
      searchQuery.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const parts =
      text.split(
        new RegExp(
          `(${escaped})`,
          "gi"
        )
      );

    return parts.map(
      (part, index) =>
        part.toLowerCase() ===
        searchQuery
          .toLowerCase()
          .trim() ? (
          <mark
            key={index}
            className="bg-yellow-200 rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        )
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">

          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-500" />

          <p className="text-slate-500 mt-4">
            Loading meeting...
          </p>

        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">

        <div className="text-center">

          <h2 className="text-xl font-semibold text-slate-900">
            Meeting not found
          </h2>

          <button
            onClick={() =>
              navigate("/dashboard")
            }
            className="mt-5 px-5 py-2.5 bg-slate-900 text-white rounded-xl"
          >
            Back to Dashboard
          </button>

        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      <header className="bg-white border-b border-slate-200">

        <div className="max-w-7xl mx-auto px-6 py-4">

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

            <div className="flex items-center gap-4">

              <button
                onClick={() =>
                  navigate("/dashboard")
                }
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div>

                <h1 className="text-2xl font-bold text-slate-900">
                  {meeting.title ||
                    "Untitled Meeting"}
                </h1>

                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">

                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4" />
                    {formatDate(
                      meeting.created_at
                    )}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Clock3 className="w-4 h-4" />
                    {formatDuration(
                      meeting.duration
                    )}
                  </span>

                  <span
                    className={`px-3 py-1 rounded-full border text-xs font-medium ${getStatusClass(
                      meeting.status
                    )}`}
                  >
                    {getStatusLabel(
                      meeting.status
                    )}
                  </span>

                </div>

              </div>

            </div>


            <div className="flex flex-wrap gap-2">

              {meeting.status ===
                "audio_ready" && (
                <button
                  onClick={
                    transcribeMeeting
                  }
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {processing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}

                  Transcribe
                </button>
              )}

              {transcript &&
                meeting.status ===
                  "transcribed" && (
                <button
                  onClick={
                    diarizeMeeting
                  }
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {processing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}

                  Identify Speakers
                </button>
              )}

              {transcript &&
                (meeting.status ===
                  "transcribed" ||
                  meeting.status ===
                    "completed") && (
                <button
                  onClick={
                    analyzeMeeting
                  }
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {processing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}

                  Analyze Meeting
                </button>
              )}

              {meeting.status ===
                "completed" && (
                <button
                  onClick={
                    downloadReport
                  }
                  disabled={
                    downloadingReport
                  }
                  className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white text-slate-900 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
                >
                  {downloadingReport ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}

                  Download Report
                </button>
              )}

            </div>

          </div>

        </div>

      </header>


      <main className="max-w-7xl mx-auto px-6 py-8">

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
            {error}
          </div>
        )}


        {meetingScore && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">

              <div>

                <p className="text-sm font-medium text-slate-500">
                  Meeting Effectiveness
                </p>

                <div className="flex items-baseline gap-3 mt-2">

                  <span className="text-5xl font-bold text-slate-900">
                    {meetingScore.score}
                  </span>

                  <span className="text-lg text-slate-400">
                    /100
                  </span>

                </div>

                <p className="text-sm text-slate-500 mt-2 max-w-2xl">
                  Overall meeting quality based on
                  participation, sentiment, action
                  items, transcript quality and
                  efficiency.
                </p>

              </div>


              <div className="flex flex-col items-center">

                <div className="w-28 h-28 rounded-full border-8 border-slate-200 flex items-center justify-center">

                  <span className="text-2xl font-bold text-slate-900">
                    {meetingScore.score}
                  </span>

                </div>

                <span className="mt-3 text-sm font-semibold text-slate-700">
                  {meetingScore.rating}
                </span>

              </div>

            </div>

          </section>
        )}


        {meetingScore?.breakdown && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">

            {[
              [
                "Participation",
                meetingScore.breakdown
                  .participation,
                25,
              ],
              [
                "Sentiment",
                meetingScore.breakdown
                  .sentiment,
                20,
              ],
              [
                "Action Items",
                meetingScore.breakdown
                  .action_items,
                25,
              ],
              [
                "Transcript",
                meetingScore.breakdown
                  .transcript_quality,
                20,
              ],
              [
                "Efficiency",
                meetingScore.breakdown
                  .efficiency,
                10,
              ],
            ].map(
              ([
                label,
                value,
                max,
              ]) => {

                const percentage =
                  max
                    ? Math.round(
                        (value /
                          max) *
                          100
                      )
                    : 0;

                return (
                  <div
                    key={label}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
                  >

                    <div className="flex justify-between">

                      <span className="text-sm text-slate-500">
                        {label}
                      </span>

                      <span className="text-sm font-semibold text-slate-900">
                        {value}/{max}
                      </span>

                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 mt-3">

                      <div
                        className="bg-slate-800 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />

                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}


        {analytics && (
          <section className="mb-8">

            <div className="mb-5">

              <h2 className="text-xl font-semibold text-slate-900">
                Meeting Intelligence
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                AI-powered insights from your meeting
              </p>

            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-sm text-slate-500">
                      Total Words
                    </p>

                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {analytics.totalWords}
                    </p>

                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl">
                    <MessageSquareText className="w-6 h-6 text-slate-700" />
                  </div>

                </div>

              </div>


              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-sm text-slate-500">
                      Speakers
                    </p>

                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {analytics.speakerCount}
                    </p>

                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl">
                    <Users className="w-6 h-6 text-slate-700" />
                  </div>

                </div>

              </div>


              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-sm text-slate-500">
                      Positive Segments
                    </p>

                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {analytics.positive}
                    </p>

                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-slate-700" />
                  </div>

                </div>

              </div>


              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-sm text-slate-500">
                      Action Items
                    </p>

                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {actionItems.length}
                    </p>

                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl">
                    <CheckCircle2 className="w-6 h-6 text-slate-700" />
                  </div>

                </div>

              </div>

            </div>

          </section>
        )}


        {(analytics?.positive ||
          analytics?.negative ||
          analytics?.neutral) ? (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex items-center gap-3 mb-6">

              <div className="p-3 bg-slate-100 rounded-xl">
                <BarChart3 className="w-6 h-6 text-slate-700" />
              </div>

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  Sentiment Overview
                </h2>

                <p className="text-sm text-slate-500">
                  Overall emotional tone of the conversation
                </p>

              </div>

            </div>


            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              <div className="border border-slate-200 rounded-xl p-5">

                <div className="flex justify-between mb-3">

                  <span className="text-sm font-medium text-slate-600">
                    Positive
                  </span>

                  <span className="font-semibold text-slate-900">
                    {analytics.positive}
                  </span>

                </div>

                <div className="w-full bg-slate-100 rounded-full h-3">

                  <div
                    className="bg-slate-800 h-3 rounded-full"
                    style={{
                      width: `${getSentimentPercentage(
                        analytics.positive
                      )}%`,
                    }}
                  />

                </div>

              </div>


              <div className="border border-slate-200 rounded-xl p-5">

                <div className="flex justify-between mb-3">

                  <span className="text-sm font-medium text-slate-600">
                    Negative
                  </span>

                  <span className="font-semibold text-slate-900">
                    {analytics.negative}
                  </span>

                </div>

                <div className="w-full bg-slate-100 rounded-full h-3">

                  <div
                    className="bg-slate-800 h-3 rounded-full"
                    style={{
                      width: `${getSentimentPercentage(
                        analytics.negative
                      )}%`,
                    }}
                  />

                </div>

              </div>


              <div className="border border-slate-200 rounded-xl p-5">

                <div className="flex justify-between mb-3">

                  <span className="text-sm font-medium text-slate-600">
                    Neutral
                  </span>

                  <span className="font-semibold text-slate-900">
                    {analytics.neutral}
                  </span>

                </div>

                <div className="w-full bg-slate-100 rounded-full h-3">

                  <div
                    className="bg-slate-800 h-3 rounded-full"
                    style={{
                      width: `${getSentimentPercentage(
                        analytics.neutral
                      )}%`,
                    }}
                  />

                </div>

              </div>

            </div>

          </section>
        ) : null}


        {insights.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex items-center gap-3 mb-6">

              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-slate-700" />
              </div>

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  AI Meeting Insights
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  What the AI found in this meeting
                </p>

              </div>

            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {insights.map(
                (insight, index) => {

                  const isWarning =
                    insight.type ===
                    "warning";

                  return (
                    <div
                      key={index}
                      className="border border-slate-200 rounded-xl p-5"
                    >

                      <div className="flex items-start gap-3">

                        <div className="mt-1">

                          {isWarning ? (
                            <Clock3 className="w-5 h-5 text-slate-600" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5 text-slate-600" />
                          )}

                        </div>

                        <div>

                          <h3 className="font-semibold text-slate-900">
                            {insight.title}
                          </h3>

                          <p className="text-sm text-slate-600 mt-2 leading-6">
                            {insight.description}
                          </p>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </section>
        )}


        {recommendations.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex items-center gap-3 mb-6">

              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-slate-700" />
              </div>

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  AI Recommendations
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Suggestions to improve future meetings
                </p>

              </div>

            </div>


            <div className="space-y-3">

              {recommendations.map(
                (
                  recommendation,
                  index
                ) => (
                  <div
                    key={index}
                    className="flex gap-3 p-4 bg-slate-50 rounded-xl"
                  >

                    <span className="w-7 h-7 shrink-0 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </span>

                    <p className="text-sm text-slate-700 leading-6">
                      {recommendation}
                    </p>

                  </div>
                )
              )}

            </div>

          </section>
        )}


        <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

          <div className="flex items-center justify-between mb-6">

            <div>

              <h2 className="text-xl font-semibold text-slate-900">
                Speaker Intelligence
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Participation and speaking analysis
              </p>

            </div>

            {dominantSpeaker && (
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">

                <span className="text-sm text-slate-500">
                  Most Active
                </span>

                <span className="text-sm font-semibold text-slate-900">
                  {dominantSpeaker.speaker}
                </span>

              </div>
            )}

          </div>


          {speakerAnalytics.length === 0 ? (

            <div className="text-center py-10 text-slate-500">
              Speaker analytics are not available yet.
            </div>

          ) : (

            <div className="space-y-6">

              {speakerAnalytics.map(
                (speaker) => {

                  const percentage =
                    getSpeakerPercentage(
                      speaker.word_count
                    );

                  const speakingTime =
                    Number(
                      speaker.speaking_time ||
                        0
                    );

                  const minutes =
                    Math.floor(
                      speakingTime / 60
                    );

                  const seconds =
                    Math.floor(
                      speakingTime % 60
                    );

                  return (
                    <div
                      key={speaker.id}
                      className="border border-slate-200 rounded-xl p-5"
                    >

                      <div className="flex items-center justify-between mb-4">

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">

                            <Users className="w-5 h-5 text-slate-600" />

                          </div>

                          <div>

                            <p className="font-semibold text-slate-900">
                              {speaker.speaker}
                            </p>

                            <p className="text-sm text-slate-500">
                              {speaker.word_count ||
                                0}{" "}
                              words
                            </p>

                          </div>

                        </div>

                        <div className="text-right">

                          <p className="text-xl font-bold text-slate-900">
                            {percentage}%
                          </p>

                          <p className="text-xs text-slate-500">
                            participation
                          </p>

                        </div>

                      </div>


                      <div className="w-full bg-slate-100 rounded-full h-3">

                        <div
                          className="bg-slate-800 h-3 rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />

                      </div>


                      <div className="grid grid-cols-2 gap-4 mt-4">

                        <div className="bg-slate-50 rounded-lg p-3">

                          <p className="text-xs text-slate-500">
                            Speaking Time
                          </p>

                          <p className="font-semibold text-slate-900 mt-1">
                            {minutes}m{" "}
                            {seconds}s
                          </p>

                        </div>


                        <div className="bg-slate-50 rounded-lg p-3">

                          <p className="text-xs text-slate-500">
                            Word Count
                          </p>

                          <p className="font-semibold text-slate-900 mt-1">
                            {speaker.word_count ||
                              0}
                          </p>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          )}

        </section>


        <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

          <div className="flex items-center justify-between mb-6">

            <div>

              <h2 className="text-xl font-semibold text-slate-900">
                Action Items
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Tasks identified from the meeting
              </p>

            </div>

            <div className="text-right">

              <p className="text-sm text-slate-500">
                {actionItems.length} tasks
              </p>

              <p className="text-sm font-semibold text-slate-900">
                {actionCompletionRate}% completed
              </p>

            </div>

          </div>


          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">

            <div className="bg-slate-50 rounded-xl p-4">

              <p className="text-xs text-slate-500">
                Total
              </p>

              <p className="text-2xl font-bold mt-1">
                {actionItems.length}
              </p>

            </div>

            <div className="bg-slate-50 rounded-xl p-4">

              <p className="text-xs text-slate-500">
                Pending
              </p>

              <p className="text-2xl font-bold mt-1">
                {pendingActionItems}
              </p>

            </div>

            <div className="bg-slate-50 rounded-xl p-4">

              <p className="text-xs text-slate-500">
                In Progress
              </p>

              <p className="text-2xl font-bold mt-1">
                {inProgressActionItems}
              </p>

            </div>

            <div className="bg-slate-50 rounded-xl p-4">

              <p className="text-xs text-slate-500">
                Completed
              </p>

              <p className="text-2xl font-bold mt-1">
                {completedActionItems}
              </p>

            </div>

          </div>


          <div className="flex flex-wrap gap-2 mb-5">

            {[
              ["all", "All"],
              ["pending", "Pending"],
              [
                "in_progress",
                "In Progress",
              ],
              [
                "completed",
                "Completed",
              ],
              ["overdue", "Overdue"],
            ].map(
              ([value, label]) => (
                <button
                  key={value}
                  onClick={() =>
                    setActionFilter(
                      value
                    )
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    actionFilter ===
                    value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              )
            )}

          </div>


          {overdueActionItems > 0 && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {overdueActionItems} action item
              {overdueActionItems !==
              1
                ? "s are"
                : " is"}{" "}
              overdue.
            </div>
          )}


          {filteredActionItems.length ===
          0 ? (

            <div className="text-center py-10 text-slate-500">
              No action items found for this filter.
            </div>

          ) : (

            <div className="space-y-4">

              {filteredActionItems.map(
                (item) => (

                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-xl p-4 hover:shadow-sm transition"
                  >

                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">

                      <div className="flex gap-3">

                        <div className="mt-1">

                          {item.status ===
                          "completed" ? (
                            <CheckCircle2 className="w-5 h-5 text-slate-700" />
                          ) : (
                            <Clock3 className="w-5 h-5 text-slate-500" />
                          )}

                        </div>

                        <div>

                          <div className="flex flex-wrap items-center gap-2">

                            <p
                              className={`font-medium ${
                                item.status ===
                                "completed"
                                  ? "line-through text-slate-400"
                                  : "text-slate-900"
                              }`}
                            >
                              {item.task}
                            </p>

                            <span
                              className={`px-2.5 py-1 rounded-full border text-xs font-medium ${getPriorityClass(
                                item.priority
                              )}`}
                            >
                              {item.priority ||
                                "medium"}
                            </span>

                            {isOverdue(
                              item
                            ) && (
                              <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-medium">
                                Overdue
                              </span>
                            )}

                          </div>


                          <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">

                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {item.assigned_to ||
                                "Unknown"}
                            </span>

                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-4 h-4" />
                              {item.deadline ||
                                "Not mentioned"}
                            </span>

                          </div>

                        </div>

                      </div>


                      <div className="flex flex-wrap gap-2">

                        <select
                          value={
                            item.priority ||
                            "medium"
                          }
                          onChange={(e) =>
                            updateActionItemPriority(
                              item.id,
                              e.target.value
                            )
                          }
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          <option value="low">
                            Low
                          </option>

                          <option value="medium">
                            Medium
                          </option>

                          <option value="high">
                            High
                          </option>
                        </select>


                        <select
                          value={
                            item.status ||
                            "pending"
                          }
                          onChange={(e) =>
                            updateActionItemStatus(
                              item.id,
                              e.target.value
                            )
                          }
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
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

                )
              )}

            </div>

          )}

        </section>


        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">

            <div>

              <h2 className="text-xl font-semibold text-slate-900">
                Transcript
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Search and filter the meeting conversation
              </p>

            </div>

            {transcript && (
              <div className="text-sm text-slate-500">
                Showing{" "}
                {filteredSegments.length}{" "}
                of{" "}
                {transcript.segments?.length ||
                  0}{" "}
                segments
              </div>
            )}

          </div>


          {!transcript ? (

            <div className="text-center py-12">

              <MessageSquareText className="w-10 h-10 mx-auto text-slate-400" />

              <h3 className="font-semibold text-slate-900 mt-4">
                No transcript available
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                Transcribe the meeting to view its conversation.
              </p>

            </div>

          ) : (

            <>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">

                <div className="relative md:col-span-2">

                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(
                        e.target.value
                      )
                    }
                    placeholder="Search transcript..."
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                  />

                </div>


                <select
                  value={
                    selectedSpeaker
                  }
                  onChange={(e) =>
                    setSelectedSpeaker(
                      e.target.value
                    )
                  }
                  className="px-4 py-3 border border-slate-200 rounded-xl bg-white outline-none"
                >
                  <option value="ALL">
                    All speakers
                  </option>

                  {speakers.map(
                    (speaker) => (
                      <option
                        key={speaker}
                        value={speaker}
                      >
                        {speaker}
                      </option>
                    )
                  )}

                </select>

              </div>


              <div className="border border-slate-200 rounded-xl overflow-hidden">

                <div className="max-h-[650px] overflow-y-auto divide-y divide-slate-100">

                  {filteredSegments.length ===
                  0 ? (

                    <div className="text-center py-12">

                      <Search className="w-8 h-8 mx-auto text-slate-400" />

                      <p className="text-slate-500 mt-3">
                        No transcript segments match your search.
                      </p>

                    </div>

                  ) : (

                    filteredSegments.map(
                      (segment, index) => (

                        <div
                          key={`${segment.start}-${index}`}
                          className="p-5 hover:bg-slate-50 transition"
                        >

                          <div className="flex items-start gap-4">

                            <div className="shrink-0">

                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
                                <Clock3 className="w-3.5 h-3.5" />
                                {formatTimestamp(
                                  segment.start
                                )}
                              </span>

                            </div>


                            <div className="min-w-0">

                              <div className="flex items-center gap-2 mb-2">

                                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">

                                  <User className="w-4 h-4 text-slate-600" />

                                </div>

                                <span className="text-sm font-semibold text-slate-900">
                                  {segment.speaker ||
                                    "UNKNOWN"}
                                </span>

                              </div>

                              <p className="text-sm text-slate-700 leading-7">
                                {highlightText(
                                  segment.text ||
                                    ""
                                )}
                              </p>

                            </div>

                          </div>

                        </div>

                      )
                    )

                  )}

                </div>

              </div>

            </>

          )}

        </section>

      </main>

    </div>
  );
}

export default MeetingDetails;

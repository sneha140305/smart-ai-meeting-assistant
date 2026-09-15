import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileAudio,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Smile,
  Sparkles,
  TrendingUp,
  User,
  Users,
  XCircle,
} from "lucide-react";

export default function MeetingDetails() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [speakerAnalytics, setSpeakerAnalytics] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [transcribing, setTranscribing] = useState(false);
  const [diarizing, setDiarizing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [error, setError] = useState("");

  // Transcript controls
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("ALL");

  // --------------------------------------------------
  // FETCH MEETING DATA
  // --------------------------------------------------

  const fetchMeetingData = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const [
        meetingResponse,
        transcriptResponse,
        actionItemsResponse,
        speakerResponse,
      ] = await Promise.all([
        api.get(`/meetings/${meetingId}`),

        api
          .get(`/meetings/${meetingId}/transcript`)
          .catch(() => ({ data: null })),

        api
          .get(`/meetings/${meetingId}/action-items`)
          .catch(() => ({ data: [] })),

        api
          .get(`/meetings/${meetingId}/speaker-analytics`)
          .catch(() => ({ data: [] })),
      ]);

      setMeeting(meetingResponse.data);
      setTranscript(transcriptResponse.data);
      setActionItems(actionItemsResponse.data || []);
      setSpeakerAnalytics(speakerResponse.data || []);
    } catch (err) {
      console.error("Failed to fetch meeting:", err);

      setError(
        err.response?.data?.detail ||
          "Failed to load meeting details."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMeetingData(true);
  }, [meetingId]);

  // --------------------------------------------------
  // TRANSCRIBE
  // --------------------------------------------------

  const handleTranscribe = async () => {
    try {
      setTranscribing(true);
      setError("");

      await api.post(`/meetings/${meetingId}/transcribe`);

      await fetchMeetingData(false);
    } catch (err) {
      console.error("Transcription failed:", err);

      setError(
        err.response?.data?.detail ||
          "Transcription failed. Please try again."
      );
    } finally {
      setTranscribing(false);
    }
  };

  // --------------------------------------------------
  // DIARIZE
  // --------------------------------------------------

  const handleDiarize = async () => {
    try {
      setDiarizing(true);
      setError("");

      await api.post(`/meetings/${meetingId}/diarize`);

      await fetchMeetingData(false);
    } catch (err) {
      console.error("Diarization failed:", err);

      setError(
        err.response?.data?.detail ||
          "Speaker diarization failed. Please try again."
      );
    } finally {
      setDiarizing(false);
    }
  };

  // --------------------------------------------------
  // AI ANALYSIS
  // --------------------------------------------------

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      setError("");

      await api.post(`/meetings/${meetingId}/analyze`);

      await fetchMeetingData(false);
    } catch (err) {
      console.error("Analysis failed:", err);

      setError(
        err.response?.data?.detail ||
          "AI analysis failed. Please try again."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // --------------------------------------------------
  // ACTION ITEM STATUS
  // --------------------------------------------------

  const updateActionItemStatus = async (
    actionItemId,
    status
  ) => {
    try {
      setError("");

      await api.patch(
        `/meetings/${meetingId}/action-items/${actionItemId}`,
        null,
        {
          params: {
            status,
          },
        }
      );

      const response = await api.get(
        `/meetings/${meetingId}/action-items`
      );

      setActionItems(response.data || []);
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

  // --------------------------------------------------
  // DERIVED DATA
  // --------------------------------------------------

  const hasTranscript =
    transcript &&
    Array.isArray(transcript.segments) &&
    transcript.segments.length > 0;

  const speakers = useMemo(() => {
    if (!hasTranscript) return [];

    return [
      ...new Set(
        transcript.segments.map(
          (segment) => segment.speaker || "UNKNOWN"
        )
      ),
    ];
  }, [transcript, hasTranscript]);

  const filteredSegments = useMemo(() => {
    if (!hasTranscript) return [];

    const query = searchQuery
      .toLowerCase()
      .trim();

    return transcript.segments.filter((segment) => {
      const text =
        segment.text?.toLowerCase() || "";

      const speaker =
        segment.speaker || "UNKNOWN";

      const matchesSearch =
        !query || text.includes(query);

      const matchesSpeaker =
        selectedSpeaker === "ALL" ||
        speaker === selectedSpeaker;

      return matchesSearch && matchesSpeaker;
    });
  }, [
    transcript,
    hasTranscript,
    searchQuery,
    selectedSpeaker,
  ]);

  const analytics = useMemo(() => {
    return {
      totalWords: meeting?.total_words || 0,
      speakerCount: meeting?.speaker_count || 0,
      positive: meeting?.positive_sentiment || 0,
      negative: meeting?.negative_sentiment || 0,
      neutral: meeting?.neutral_sentiment || 0,
    };
  }, [meeting]);

  const completedActionItems =
    actionItems.filter(
      (item) => item.status === "completed"
    ).length;

  const actionCompletionRate =
    actionItems.length > 0
      ? Math.round(
          (completedActionItems /
            actionItems.length) *
            100
        )
      : 0;

  const dominantSpeaker =
    speakerAnalytics.length > 0
      ? [...speakerAnalytics].sort(
          (a, b) =>
            (b.word_count || 0) -
            (a.word_count || 0)
        )[0]
      : null;

  const getSpeakerPercentage = (wordCount) => {
    const totalWords = speakerAnalytics.reduce(
      (total, speaker) =>
        total + (speaker.word_count || 0),
      0
    );

    if (!totalWords) return 0;

    return Math.round(
      ((wordCount || 0) / totalWords) * 100
    );
  };

  const getSentimentPercentage = (value) => {
    const total =
      (analytics.positive || 0) +
      (analytics.negative || 0) +
      (analytics.neutral || 0);

    if (!total) return 0;

    return Math.round(
      (value / total) * 100
    );
  };

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  const formatTimestamp = (seconds) => {
    const totalSeconds = Math.floor(
      Number(seconds || 0)
    );

    const minutes = Math.floor(
      totalSeconds / 60
    );

    const remainingSeconds =
      totalSeconds % 60;

    return `${minutes}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "Not available";

    const totalSeconds = Number(seconds);

    const hours = Math.floor(
      totalSeconds / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const remainingSeconds =
      Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    return `${remainingSeconds}s`;
  };

  const formatDate = (date) => {
    if (!date) return "Not available";

    return new Date(date).toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-50 text-green-700 border-green-200";

      case "processing":
      case "preprocessing":
      case "audio_ready":
      case "transcribing":
      case "diarizing":
      case "analyzing":
        return "bg-amber-50 text-amber-700 border-amber-200";

      case "failed":
      case "transcription_failed":
      case "diarization_failed":
      case "analysis_failed":
        return "bg-red-50 text-red-700 border-red-200";

      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const getActionStatusClass = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-50 text-green-700 border-green-200";

      case "in_progress":
        return "bg-blue-50 text-blue-700 border-blue-200";

      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const highlightText = (text) => {
    if (!searchQuery.trim()) {
      return text;
    }

    const query = searchQuery.trim();

    const parts = text.split(
      new RegExp(`(${query})`, "gi")
    );

    return parts.map((part, index) =>
      part.toLowerCase() ===
      query.toLowerCase() ? (
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

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-700" />

          <p className="text-sm text-slate-500">
            Loading meeting...
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // ERROR / NOT FOUND
  // --------------------------------------------------

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 py-10">

          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="mt-10 bg-white border border-red-200 rounded-2xl p-8 text-center">

            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />

            <h2 className="text-xl font-semibold text-slate-900">
              Meeting not found
            </h2>

            <p className="text-slate-500 mt-2">
              {error || "Unable to load this meeting."}
            </p>

          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50">

      {/* HEADER */}

      <header className="bg-white border-b border-slate-200">

        <div className="max-w-7xl mx-auto px-6 py-5">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div>

              <button
                onClick={() =>
                  navigate("/dashboard")
                }
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>

              <div className="flex items-start gap-4">

                <div className="p-3 bg-slate-900 rounded-xl">
                  <FileAudio className="w-6 h-6 text-white" />
                </div>

                <div>

                  <h1 className="text-2xl font-bold text-slate-900">
                    {meeting.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">

                    <span className="flex items-center gap-1.5">
                      <FileAudio className="w-4 h-4" />
                      {meeting.file_name}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {formatDuration(
                        meeting.duration
                      )}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4" />
                      {formatDate(
                        meeting.created_at
                      )}
                    </span>

                  </div>

                </div>

              </div>

            </div>


            <div className="flex items-center gap-3">

              <span
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${getStatusClass(
                  meeting.status
                )}`}
              >
                {meeting.status}
              </span>

              <button
                onClick={() =>
                  fetchMeetingData(false)
                }
                disabled={refreshing}
                className="p-2.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-5 h-5 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />
              </button>

            </div>

          </div>

        </div>

      </header>


      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* ERROR */}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-start gap-3">

            <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />

            <p className="text-sm">
              {error}
            </p>

          </div>
        )}


        {/* PROCESSING ACTIONS */}

        <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

          <div className="flex items-center gap-3 mb-5">

            <div className="p-3 bg-slate-100 rounded-xl">
              <Sparkles className="w-5 h-5 text-slate-700" />
            </div>

            <div>

              <h2 className="text-lg font-semibold text-slate-900">
                Meeting Processing
              </h2>

              <p className="text-sm text-slate-500">
                Process your recording step by step
              </p>

            </div>

          </div>


          <div className="flex flex-wrap gap-3">

            <button
              onClick={handleTranscribe}
              disabled={
                transcribing ||
                !meeting.audio_path ||
                meeting.status === "transcribing"
              }
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {transcribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquareText className="w-4 h-4" />
              )}

              {transcribing
                ? "Transcribing..."
                : "Transcribe"}
            </button>


            <button
              onClick={handleDiarize}
              disabled={
                diarizing ||
                !hasTranscript ||
                meeting.status === "diarizing"
              }
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {diarizing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}

              {diarizing
                ? "Identifying Speakers..."
                : "Identify Speakers"}
            </button>


            <button
              onClick={handleAnalyze}
              disabled={
                analyzing ||
                !hasTranscript ||
                meeting.status === "analyzing"
              }
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}

              {analyzing
                ? "Analyzing..."
                : "Analyze Meeting"}
            </button>

          </div>

        </section>


        {/* AI SUMMARY */}

        {meeting.summary && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex items-center gap-3 mb-5">

              <div className="p-3 bg-slate-900 rounded-xl">
                <Sparkles className="w-5 h-5 text-white" />
              </div>

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  AI Meeting Summary
                </h2>

                <p className="text-sm text-slate-500">
                  Generated from the meeting transcript
                </p>

              </div>

            </div>

            <p className="text-slate-700 leading-7 whitespace-pre-line">
              {meeting.summary}
            </p>

          </section>
        )}


        {/* MEETING INTELLIGENCE */}

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

            {/* TOTAL WORDS */}

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

                <div className="p-3 bg-blue-50 rounded-xl">
                  <MessageSquareText className="w-6 h-6 text-blue-600" />
                </div>

              </div>

            </div>


            {/* SPEAKERS */}

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

                <div className="p-3 bg-purple-50 rounded-xl">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>

              </div>

            </div>


            {/* POSITIVE */}

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

                <div className="p-3 bg-green-50 rounded-xl">
                  <Smile className="w-6 h-6 text-green-600" />
                </div>

              </div>

            </div>


            {/* ACTION ITEMS */}

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

                <div className="p-3 bg-amber-50 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-amber-600" />
                </div>

              </div>

            </div>

          </div>

        </section>


        {/* SENTIMENT */}

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

            {/* POSITIVE */}

            <div className="border border-green-100 rounded-xl p-5">

              <div className="flex justify-between mb-3">

                <span className="text-sm font-medium text-slate-600">
                  Positive
                </span>

                <span className="font-semibold text-green-600">
                  {analytics.positive}
                </span>

              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">

                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${getSentimentPercentage(
                      analytics.positive
                    )}%`,
                  }}
                />

              </div>

              <p className="text-xs text-slate-400 mt-2">
                {getSentimentPercentage(
                  analytics.positive
                )}
                %
              </p>

            </div>


            {/* NEGATIVE */}

            <div className="border border-red-100 rounded-xl p-5">

              <div className="flex justify-between mb-3">

                <span className="text-sm font-medium text-slate-600">
                  Negative
                </span>

                <span className="font-semibold text-red-600">
                  {analytics.negative}
                </span>

              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">

                <div
                  className="bg-red-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${getSentimentPercentage(
                      analytics.negative
                    )}%`,
                  }}
                />

              </div>

              <p className="text-xs text-slate-400 mt-2">
                {getSentimentPercentage(
                  analytics.negative
                )}
                %
              </p>

            </div>


            {/* NEUTRAL */}

            <div className="border border-slate-200 rounded-xl p-5">

              <div className="flex justify-between mb-3">

                <span className="text-sm font-medium text-slate-600">
                  Neutral
                </span>

                <span className="font-semibold text-slate-600">
                  {analytics.neutral}
                </span>

              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">

                <div
                  className="bg-slate-400 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${getSentimentPercentage(
                      analytics.neutral
                    )}%`,
                  }}
                />

              </div>

              <p className="text-xs text-slate-400 mt-2">
                {getSentimentPercentage(
                  analytics.neutral
                )}
                %
              </p>

            </div>

          </div>

        </section>


        {/* KEY POINTS + DECISIONS */}

        {(meeting.key_points ||
          meeting.decisions) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

            {/* KEY POINTS */}

            {meeting.key_points && (
              <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

                <div className="flex items-center gap-3 mb-5">

                  <div className="p-3 bg-blue-50 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>

                  <h2 className="text-xl font-semibold text-slate-900">
                    Key Points
                  </h2>

                </div>

                <div className="space-y-3">

                  {(() => {
                    try {
                      const points =
                        JSON.parse(
                          meeting.key_points
                        );

                      if (!Array.isArray(points)) {
                        return (
                          <p className="text-slate-600">
                            {meeting.key_points}
                          </p>
                        );
                      }

                      return points.map(
                        (point, index) => (
                          <div
                            key={index}
                            className="flex gap-3"
                          >
                            <span className="mt-2 w-2 h-2 rounded-full bg-slate-700 flex-shrink-0" />

                            <p className="text-slate-700 leading-6">
                              {point}
                            </p>
                          </div>
                        )
                      );
                    } catch {
                      return (
                        <p className="text-slate-600">
                          {meeting.key_points}
                        </p>
                      );
                    }
                  })()}

                </div>

              </section>
            )}


            {/* DECISIONS */}

            {meeting.decisions && (
              <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

                <div className="flex items-center gap-3 mb-5">

                  <div className="p-3 bg-purple-50 rounded-xl">
                    <CheckCircle2 className="w-5 h-5 text-purple-600" />
                  </div>

                  <h2 className="text-xl font-semibold text-slate-900">
                    Decisions
                  </h2>

                </div>

                <div className="space-y-3">

                  {(() => {
                    try {
                      const decisions =
                        JSON.parse(
                          meeting.decisions
                        );

                      if (!Array.isArray(decisions)) {
                        return (
                          <p className="text-slate-600">
                            {meeting.decisions}
                          </p>
                        );
                      }

                      return decisions.map(
                        (decision, index) => (
                          <div
                            key={index}
                            className="flex gap-3"
                          >
                            <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />

                            <p className="text-slate-700 leading-6">
                              {decision}
                            </p>
                          </div>
                        )
                      );
                    } catch {
                      return (
                        <p className="text-slate-600">
                          {meeting.decisions}
                        </p>
                      );
                    }
                  })()}

                </div>

              </section>
            )}

          </div>
        )}


        {/* SPEAKER INTELLIGENCE */}

        <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

          <div className="flex items-center justify-between mb-6">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-slate-100 rounded-xl">
                <Users className="w-6 h-6 text-slate-700" />
              </div>

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  Speaker Intelligence
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Participation and speaking analysis
                </p>

              </div>

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

            <div className="text-center py-10">

              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />

              <p className="text-slate-500">
                Speaker analytics are not available yet.
              </p>

              {hasTranscript && (
                <p className="text-xs text-slate-400 mt-1">
                  Run speaker identification to generate speaker analytics.
                </p>
              )}

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
                      speaker.speaking_time || 0
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

                        <div className="flex gap-3 items-center">

                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">

                            <User className="w-5 h-5 text-slate-600" />

                          </div>

                          <div>

                            <p className="font-semibold text-slate-900">
                              {speaker.speaker}
                            </p>

                            <p className="text-sm text-slate-500">
                              {speaker.word_count || 0} words
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
                          className="h-3 rounded-full bg-slate-800 transition-all duration-500"
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
                            {speaker.word_count || 0}
                          </p>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          )}


          {dominantSpeaker &&
            speakerAnalytics.length > 1 && (
              <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">

                <div className="flex gap-3">

                  <TrendingUp className="w-5 h-5 text-slate-700 mt-0.5 flex-shrink-0" />

                  <p className="text-sm text-slate-600">

                    <span className="font-semibold text-slate-900">
                      {dominantSpeaker.speaker}
                    </span>{" "}

                    had the highest participation with{" "}

                    <span className="font-semibold text-slate-900">
                      {getSpeakerPercentage(
                        dominantSpeaker.word_count
                      )}
                      %
                    </span>{" "}

                    of the meeting's spoken words.

                  </p>

                </div>

              </div>
            )}

        </section>


        {/* ACTION ITEMS */}

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

              {actionItems.length > 0 && (
                <p className="text-sm font-medium text-slate-700 mt-1">
                  {actionCompletionRate}% completed
                </p>
              )}

            </div>

          </div>


          {actionItems.length === 0 ? (

            <div className="text-center py-10">

              <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />

              <p className="text-slate-500">
                No action items found.
              </p>

              {meeting.summary && (
                <p className="text-xs text-slate-400 mt-1">
                  AI analysis did not identify any action items.
                </p>
              )}

            </div>

          ) : (

            <div className="space-y-4">

              {actionItems.map((item) => (

                <div
                  key={item.id}
                  className="border border-slate-200 rounded-xl p-4 hover:shadow-sm transition"
                >

                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

                    <div className="flex gap-3">

                      <div className="mt-1">

                        {item.status ===
                        "completed" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-500" />
                        )}

                      </div>


                      <div>

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


                    <div className="flex items-center gap-3">

                      <span
                        className={`hidden sm:block px-2.5 py-1 rounded-lg border text-xs font-medium ${getActionStatusClass(
                          item.status
                        )}`}
                      >
                        {item.status ===
                        "in_progress"
                          ? "In Progress"
                          : item.status
                            ? item.status
                                .charAt(0)
                                .toUpperCase() +
                              item.status.slice(1)
                            : "Pending"}
                      </span>


                      <div className="relative">

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
                          className="appearance-none border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
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

                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                      </div>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>


        {/* TRANSCRIPT */}

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">

          <div className="p-6 border-b border-slate-200">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  Transcript
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Search and filter the meeting conversation
                </p>

              </div>


              {hasTranscript && (
                <div className="text-sm text-slate-500">
                  Showing{" "}
                  <span className="font-medium text-slate-900">
                    {filteredSegments.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-slate-900">
                    {transcript.segments.length}
                  </span>{" "}
                  segments
                </div>
              )}

            </div>


            {hasTranscript && (
              <div className="flex flex-col md:flex-row gap-3 mt-5">

                {/* SEARCH */}

                <div className="relative flex-1">

                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(
                        e.target.value
                      )
                    }
                    placeholder="Search transcript..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />

                </div>


                {/* SPEAKER FILTER */}

                <div className="relative">

                  <select
                    value={selectedSpeaker}
                    onChange={(e) =>
                      setSelectedSpeaker(
                        e.target.value
                      )
                    }
                    className="appearance-none w-full md:w-52 border border-slate-300 rounded-lg pl-4 pr-9 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >

                    <option value="ALL">
                      All Speakers
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

                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                </div>

              </div>
            )}

          </div>


          {!hasTranscript ? (

            <div className="p-12 text-center">

              <MessageSquareText className="w-12 h-12 text-slate-300 mx-auto mb-4" />

              <h3 className="text-lg font-semibold text-slate-900">
                No transcript available
              </h3>

              <p className="text-sm text-slate-500 mt-2 mb-5">
                Transcribe the meeting audio to see the conversation here.
              </p>

              <button
                onClick={handleTranscribe}
                disabled={
                  transcribing ||
                  !meeting.audio_path
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {transcribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquareText className="w-4 h-4" />
                )}

                {transcribing
                  ? "Transcribing..."
                  : "Transcribe Meeting"}
              </button>

            </div>

          ) : filteredSegments.length === 0 ? (

            <div className="p-12 text-center">

              <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />

              <h3 className="font-semibold text-slate-900">
                No matching transcript
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Try a different search term or speaker.
              </p>

              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSpeaker("ALL");
                }}
                className="mt-4 text-sm font-medium text-slate-700 hover:text-slate-900 underline"
              >
                Clear filters
              </button>

            </div>

          ) : (

            <div className="divide-y divide-slate-100">

              {filteredSegments.map(
                (segment, index) => {

                  const speaker =
                    segment.speaker ||
                    "UNKNOWN";

                  return (
                    <div
                      key={`${segment.start}-${index}`}
                      className="p-5 hover:bg-slate-50 transition"
                    >

                      <div className="flex gap-4">

                        {/* TIMESTAMP */}

                        <div className="flex-shrink-0">

                          <button
                            className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-mono hover:bg-slate-200"
                            title="Transcript timestamp"
                          >
                            {formatTimestamp(
                              segment.start
                            )}
                          </button>

                        </div>


                        {/* CONTENT */}

                        <div className="flex-1 min-w-0">

                          <div className="flex items-center gap-2 mb-1.5">

                            <span className="text-sm font-semibold text-slate-900">
                              {speaker}
                            </span>

                            {segment.end != null && (
                              <span className="text-xs text-slate-400">
                                {formatTimestamp(
                                  segment.end
                                )}
                              </span>
                            )}

                          </div>

                          <p className="text-slate-700 leading-7">
                            {highlightText(
                              segment.text || ""
                            )}
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


        {/* RAW TRANSCRIPT FALLBACK */}

        {!hasTranscript &&
          transcript?.content && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 mt-8 shadow-sm">

              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Transcript Text
              </h2>

              <p className="whitespace-pre-line text-slate-700 leading-7">
                {transcript.content}
              </p>

            </section>
          )}

      </main>

    </div>
  );
}


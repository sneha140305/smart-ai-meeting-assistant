import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Clock3,
  FileAudio,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Video,
  XCircle,
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

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedSpeaker, setSelectedSpeaker] =
    useState("ALL");

  const [actionFilter, setActionFilter] =
    useState("all");

  const parseJson = (value, fallback = []) => {
    if (!value) {
      return fallback;
    }

    if (Array.isArray(value)) {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };


  const formatDate = (value) => {
    if (!value) {
      return "Unknown date";
    }

    try {
      return new Date(value).toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    } catch {
      return "Unknown date";
    }
  };


  const formatTime = (seconds) => {
    const totalSeconds = Math.max(
      0,
      Math.floor(Number(seconds) || 0)
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
    const totalSeconds = Math.max(
      0,
      Math.floor(Number(seconds) || 0)
    );

    const hours = Math.floor(
      totalSeconds / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const remainingSeconds =
      totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  };


  const getStatusLabel = (status) => {
    const labels = {
      uploaded: "Uploaded",
      preprocessing: "Preparing",
      audio_ready: "Audio Ready",
      processing: "Processing",
      transcribing: "Transcribing",
      transcribed: "Transcribed",
      diarizing: "Identifying Speakers",
      analyzing: "Analyzing",
      completed: "Completed",
      diarization_failed: "Diarization Failed",
      analysis_failed: "Analysis Failed",
    };

    return labels[status] || status || "Unknown";
  };


  const getStatusClass = (status) => {
    if (status === "completed") {
      return "bg-green-50 text-green-700 border-green-200";
    }

    if (
      [
        "processing",
        "preprocessing",
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

  const fetchMeetingData = async () => {
    try {
      setLoading(true);
      setError("");

      const meetingResponse =
        await api.get(
          `/meetings/${meetingId}`
        );

      const meetingData =
        meetingResponse.data;

      setMeeting(meetingData);

      setAnalytics({
        totalWords:
          meetingData.total_words || 0,

        speakerCount:
          meetingData.speaker_count || 0,

        positive:
          meetingData.positive_sentiment || 0,

        negative:
          meetingData.negative_sentiment || 0,

        neutral:
          meetingData.neutral_sentiment || 0,
      });

      if (
        meetingData.effectiveness_score !==
        null &&
        meetingData.effectiveness_score !==
        undefined
      ) {
        setMeetingScore({
          score:
            meetingData.effectiveness_score,

          rating:
            meetingData.effectiveness_rating ||
            "",
        });
      }

      setInsights(
        parseJson(
          meetingData.meeting_insights
        )
      );

      setRecommendations(
        parseJson(
          meetingData.meeting_recommendations
        )
      );

      try {
        const transcriptResponse =
          await api.get(
            `/meetings/${meetingId}/transcript`
          );

        const transcriptData =
          transcriptResponse.data;

        setTranscript({
          ...transcriptData,

          segments: Array.isArray(
            transcriptData.segments
          )
            ? transcriptData.segments
            : parseJson(
                transcriptData.segments
              ),
        });
      } catch (transcriptError) {
        console.log(
          "Transcript not available yet:",
          transcriptError
        );

        setTranscript(null);
      }

      try {
        const actionResponse =
          await api.get(
            `/meetings/${meetingId}/action-items`
          );

        setActionItems(
          Array.isArray(
            actionResponse.data
          )
            ? actionResponse.data
            : []
        );
      } catch (actionError) {
        console.log(
          "Action items not available:",
          actionError
        );

        setActionItems([]);
      }

      try {
        const speakerResponse =
          await api.get(
            `/meetings/${meetingId}/speaker-analytics`
          );

        setSpeakerAnalytics(
          Array.isArray(
            speakerResponse.data
          )
            ? speakerResponse.data
            : []
        );
      } catch (speakerError) {
        console.log(
          "Speaker analytics not available:",
          speakerError
        );

        setSpeakerAnalytics([]);
      }

    } catch (err) {
      console.error(
        "Failed to load meeting:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to load this meeting."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchMeetingData();
  }, [meetingId]);

  const runTranscription = async () => {
    try {
      setProcessing(true);
      setMessage("");
      setError("");

      await api.post(
        `/meetings/${meetingId}/transcribe`
      );

      setMessage(
        "Transcription completed successfully."
      );

      await fetchMeetingData();

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


  const runDiarization = async () => {
    try {
      setProcessing(true);
      setMessage("");
      setError("");

      await api.post(
        `/meetings/${meetingId}/diarize`
      );

      setMessage(
        "Speaker identification completed."
      );

      await fetchMeetingData();

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


  const runAnalysis = async () => {
    try {
      setProcessing(true);
      setMessage("");
      setError("");

      const response =
        await api.post(
          `/meetings/${meetingId}/analyze`
        );

      const data = response.data;

      // AI results

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

      setMessage(
        "AI meeting analysis completed."
      );

      await fetchMeetingData();

    } catch (err) {
      console.error(
        "Analysis failed:",
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
      setError("");

      await api.patch(
        `/meetings/${meetingId}/action-items/${actionItemId}`,
        null,
        {
          params: {
            priority,
          },
        }
      );

      setActionItems((currentItems) =>
        currentItems.map((item) =>
          item.id === actionItemId
            ? {
                ...item,
                priority,
              }
            : item
        )
      );

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


  const getPriorityClass = (
    priority
  ) => {
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


  const completedCount =
    actionItems.filter(
      (item) =>
        item.status === "completed"
    ).length;


  const pendingCount =
    actionItems.filter(
      (item) =>
        item.status === "pending"
    ).length;


  const inProgressCount =
    actionItems.filter(
      (item) =>
        item.status === "in_progress"
    ).length;


  const overdueCount =
    actionItems.filter(
      (item) => isOverdue(item)
    ).length;


  const actionCompletionRate =
    actionItems.length
      ? Math.round(
          (completedCount /
            actionItems.length) *
            100
        )
      : 0;


  const filteredActionItems =
    actionItems.filter((item) => {
      if (actionFilter === "all") {
        return true;
      }

      if (actionFilter === "overdue") {
        return isOverdue(item);
      }

      return (
        item.status === actionFilter
      );
    });

  const getSpeakerPercentage = (
    wordCount
  ) => {
    const totalWords =
      speakerAnalytics.reduce(
        (total, speaker) =>
          total +
          Number(
            speaker.word_count || 0
          ),
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


  const dominantSpeaker =
    speakerAnalytics.length
      ? [...speakerAnalytics].sort(
          (a, b) =>
            Number(
              b.word_count || 0
            ) -
            Number(
              a.word_count || 0
            )
        )[0]
      : null;

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

  const transcriptSegments =
    transcript?.segments || [];


  const speakers = useMemo(() => {
    return [
      ...new Set(
        transcriptSegments.map(
          (segment) =>
            segment.speaker ||
            "UNKNOWN"
        )
      ),
    ];
  }, [transcriptSegments]);


  const filteredSegments = useMemo(() => {
    const query =
      searchQuery
        .trim()
        .toLowerCase();

    return transcriptSegments.filter(
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
    transcriptSegments,
    searchQuery,
    selectedSpeaker,
  ]);


  const highlightText = (text) => {
    if (!searchQuery.trim()) {
      return text;
    }

    const query =
      searchQuery.trim();

    const parts = text.split(
      new RegExp(
        `(${query.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )})`,
        "gi"
      )
    );

    return parts.map(
      (part, index) =>
        part.toLowerCase() ===
        query.toLowerCase() ? (
          <mark
            key={index}
            className="bg-yellow-200 px-0.5 rounded"
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

          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-600" />

          <p className="text-slate-500 mt-3">
            Loading meeting...
          </p>

        </div>

      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">

        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md text-center">

          <XCircle className="w-10 h-10 text-red-500 mx-auto" />

          <h2 className="text-lg font-semibold text-slate-900 mt-4">
            Unable to load meeting
          </h2>

          <p className="text-sm text-red-600 mt-2">
            {error}
          </p>

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


  if (!meeting) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}

      <header className="bg-white border-b border-slate-200">

        <div className="max-w-7xl mx-auto px-6 py-4">

          <div className="flex items-center justify-between gap-4">

            <button
              onClick={() =>
                navigate("/dashboard")
              }
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowLeft className="w-5 h-5" />

              <span className="hidden sm:inline">
                Dashboard
              </span>
            </button>


            <button
              onClick={() =>
                fetchMeetingData()
              }
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              <RefreshCw className="w-4 h-4" />

              <span className="hidden sm:inline">
                Refresh
              </span>
            </button>

          </div>

        </div>

      </header>


      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Notifications */}

        {message && (
          <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">

            <CheckCircle2 className="w-5 h-5" />

            <p className="text-sm">
              {message}
            </p>

          </div>
        )}


        {error && (
          <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">

            <XCircle className="w-5 h-5" />

            <p className="text-sm">
              {error}
            </p>

          </div>
        )}


        {/* Meeting Header */}

        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8">

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

            <div className="flex items-start gap-4">

              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">

                <Video className="w-7 h-7 text-slate-600" />

              </div>

              <div>

                <h1 className="text-2xl font-bold text-slate-900">
                  {meeting.title ||
                    "Untitled Meeting"}
                </h1>

                <p className="text-sm text-slate-500 mt-1">
                  {meeting.file_name}
                </p>

                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-slate-500">

                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4" />
                    {formatDate(
                      meeting.created_at
                    )}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {formatDuration(
                      meeting.duration
                    )}
                  </span>

                </div>

              </div>

            </div>


            <div>

              <span
                className={`inline-flex px-4 py-2 rounded-full border text-sm font-medium ${getStatusClass(
                  meeting.status
                )}`}
              >
                {getStatusLabel(
                  meeting.status
                )}
              </span>

            </div>

          </div>

        </section>


        {/* Processing Controls */}

        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8">

          <div className="flex items-center gap-3 mb-5">

            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">

              <Sparkles className="w-5 h-5 text-slate-700" />

            </div>

            <div>

              <h2 className="text-xl font-semibold text-slate-900">
                Meeting Processing
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Process the meeting step by step
              </p>

            </div>

          </div>


          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Transcribe */}

            <button
              disabled={
                processing ||
                ![
                  "audio_ready",
                  "processing",
                  "transcribed",
                  "diarizing",
                  "analyzing",
                  "completed",
                ].includes(
                  meeting.status
                )
              }
              onClick={
                runTranscription
              }
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}

              Transcribe
            </button>


            {/* Diarize */}

            <button
              disabled={
                processing ||
                !transcriptSegments.length
              }
              onClick={
                runDiarization
              }
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}

              Identify Speakers
            </button>


            {/* Analyze */}

            <button
              disabled={
                processing ||
                !transcriptSegments.length
              }
              onClick={
                runAnalysis
              }
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}

              Analyze Meeting
            </button>

          </div>

        </section>


        {/* Summary */}

        {meeting.summary && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8">

            <div className="flex items-center gap-3 mb-5">

              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">

                <FileText className="w-5 h-5 text-slate-700" />

              </div>

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  AI Summary
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Concise overview of the meeting
                </p>

              </div>

            </div>

            <p className="text-slate-700 leading-7 whitespace-pre-line">
              {meeting.summary}
            </p>

          </section>
        )}


        {/* Meeting Effectiveness */}

        {meetingScore && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">

              <div>

                <div className="flex items-center gap-2">

                  <Sparkles className="w-5 h-5 text-slate-700" />

                  <p className="text-sm font-medium text-slate-500">
                    Meeting Effectiveness
                  </p>

                </div>

                <div className="flex items-baseline gap-3 mt-2">

                  <span className="text-5xl font-bold text-slate-900">
                    {meetingScore.score}
                  </span>

                  <span className="text-lg text-slate-400">
                    /100
                  </span>

                </div>

                <p className="text-sm text-slate-500 mt-2 max-w-xl">
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


        {/* Score Breakdown */}

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
              ([label, value, max]) => {

                const percentage =
                  max
                    ? Math.round(
                        (value / max) *
                          100
                      )
                    : 0;

                return (
                  <div
                    key={label}
                    className="bg-white border border-slate-200 rounded-xl p-4"
                  >

                    <div className="flex justify-between gap-2">

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
                          width: `${Math.min(
                            100,
                            percentage
                          )}%`,
                        }}
                      />

                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}


        {/* Meeting Intelligence */}

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

            {/* Total Words */}

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm text-slate-500">
                    Total Words
                  </p>

                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {analytics?.totalWords ||
                      0}
                  </p>

                </div>

                <div className="p-3 bg-slate-100 rounded-xl">

                  <FileText className="w-6 h-6 text-slate-600" />

                </div>

              </div>

            </div>


            {/* Speakers */}

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm text-slate-500">
                    Speakers
                  </p>

                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {analytics?.speakerCount ||
                      0}
                  </p>

                </div>

                <div className="p-3 bg-slate-100 rounded-xl">

                  <Users className="w-6 h-6 text-slate-600" />

                </div>

              </div>

            </div>


            {/* Positive */}

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm text-slate-500">
                    Positive Segments
                  </p>

                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {analytics?.positive ||
                      0}
                  </p>

                </div>

                <div className="p-3 bg-slate-100 rounded-xl">

                  <TrendingUp className="w-6 h-6 text-slate-600" />

                </div>

              </div>

            </div>


            {/* Action Items */}

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

                  <CheckCircle2 className="w-6 h-6 text-slate-600" />

                </div>

              </div>

            </div>

          </div>

        </section>


        {/* AI Insights */}

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


        {/* AI Recommendations */}

        {recommendations.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex items-center gap-3 mb-6">

              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">

                <Sparkles className="w-5 h-5 text-slate-700" />

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
                (recommendation, index) => (

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


        {/* Sentiment */}

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

            {/* Positive */}

            <div className="border border-slate-200 rounded-xl p-5">

              <div className="flex justify-between mb-3">

                <span className="text-sm font-medium text-slate-600">
                  Positive
                </span>

                <span className="font-semibold text-slate-700">
                  {analytics?.positive ||
                    0}
                </span>

              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">

                <div
                  className="bg-slate-800 h-3 rounded-full transition-all"
                  style={{
                    width: `${getSentimentPercentage(
                      analytics?.positive ||
                        0
                    )}%`,
                  }}
                />

              </div>

              <p className="text-xs text-slate-500 mt-2">
                {getSentimentPercentage(
                  analytics?.positive ||
                    0
                )}
                %
              </p>

            </div>


            {/* Negative */}

            <div className="border border-slate-200 rounded-xl p-5">

              <div className="flex justify-between mb-3">

                <span className="text-sm font-medium text-slate-600">
                  Negative
                </span>

                <span className="font-semibold text-slate-700">
                  {analytics?.negative ||
                    0}
                </span>

              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">

                <div
                  className="bg-slate-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${getSentimentPercentage(
                      analytics?.negative ||
                        0
                    )}%`,
                  }}
                />

              </div>

              <p className="text-xs text-slate-500 mt-2">
                {getSentimentPercentage(
                  analytics?.negative ||
                    0
                )}
                %
              </p>

            </div>


            {/* Neutral */}

            <div className="border border-slate-200 rounded-xl p-5">

              <div className="flex justify-between mb-3">

                <span className="text-sm font-medium text-slate-600">
                  Neutral
                </span>

                <span className="font-semibold text-slate-700">
                  {analytics?.neutral ||
                    0}
                </span>

              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">

                <div
                  className="bg-slate-400 h-3 rounded-full transition-all"
                  style={{
                    width: `${getSentimentPercentage(
                      analytics?.neutral ||
                        0
                    )}%`,
                  }}
                />

              </div>

              <p className="text-xs text-slate-500 mt-2">
                {getSentimentPercentage(
                  analytics?.neutral ||
                    0
                )}
                %
              </p>

            </div>

          </div>

        </section>


        {/* Speaker Intelligence */}

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

              <Users className="w-8 h-8 mx-auto mb-3 text-slate-400" />

              Speaker analytics are not
              available yet.

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

                  return (
                    <div
                      key={
                        speaker.id ||
                        speaker.speaker
                      }
                      className="border border-slate-200 rounded-xl p-5"
                    >

                      <div className="flex items-center justify-between mb-4">

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">

                            <User className="w-5 h-5 text-slate-600" />

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
                            {formatDuration(
                              speakingTime
                            )}
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


          {dominantSpeaker &&
            speakerAnalytics.length >
              1 && (

              <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">

                <div className="flex gap-3">

                  <TrendingUp className="w-5 h-5 text-slate-700 mt-0.5 shrink-0" />

                  <p className="text-sm text-slate-600">

                    <span className="font-semibold text-slate-900">
                      {dominantSpeaker.speaker}
                    </span>{" "}
                    had the highest
                    participation with{" "}
                    <span className="font-semibold text-slate-900">
                      {getSpeakerPercentage(
                        dominantSpeaker.word_count
                      )}
                      %
                    </span>{" "}
                    of the meeting's
                    spoken words.

                  </p>

                </div>

              </div>
            )}

        </section>


        {/* Action Items */}

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

              <p className="text-sm font-semibold text-slate-900 mt-1">
                {actionCompletionRate}%
                completed
              </p>

            </div>

          </div>


          {/* Action statistics */}

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
                {pendingCount}
              </p>

            </div>


            <div className="bg-slate-50 rounded-xl p-4">

              <p className="text-xs text-slate-500">
                In Progress
              </p>

              <p className="text-2xl font-bold mt-1">
                {inProgressCount}
              </p>

            </div>


            <div className="bg-slate-50 rounded-xl p-4">

              <p className="text-xs text-slate-500">
                Completed
              </p>

              <p className="text-2xl font-bold mt-1">
                {completedCount}
              </p>

            </div>

          </div>


          {/* Filters */}

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
                    actionFilter === value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {label}

                  {value ===
                    "overdue" &&
                    overdueCount >
                      0 && (
                      <span className="ml-2">
                        {overdueCount}
                      </span>
                    )}
                </button>

              )
            )}

          </div>


          {/* Items */}

          {filteredActionItems.length ===
          0 ? (

            <div className="text-center py-10 text-slate-500">

              <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-slate-400" />

              No action items found
              for this filter.

            </div>

          ) : (

            <div className="space-y-4">

              {filteredActionItems.map(
                (item) => (

                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-xl p-5"
                  >

                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">

                      <div className="flex gap-3 flex-1">

                        <div className="mt-1">

                          {item.status ===
                          "completed" ? (
                            <CheckCircle2 className="w-5 h-5 text-slate-700" />
                          ) : (
                            <Clock3 className="w-5 h-5 text-slate-500" />
                          )}

                        </div>


                        <div className="flex-1">

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
                          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
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
                          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
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


        {/* Key Points */}

        {parseJson(
          meeting.key_points
        ).length > 0 && (

          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex items-center gap-3 mb-5">

              <FileText className="w-5 h-5 text-slate-600" />

              <h2 className="text-xl font-semibold text-slate-900">
                Key Points
              </h2>

            </div>


            <div className="space-y-3">

              {parseJson(
                meeting.key_points
              ).map(
                (point, index) => (

                  <div
                    key={index}
                    className="flex gap-3"
                  >

                    <span className="w-6 h-6 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                      {index + 1}
                    </span>

                    <p className="text-sm text-slate-700 leading-6">
                      {point}
                    </p>

                  </div>

                )
              )}

            </div>

          </section>

        )}


        {/* Decisions */}

        {parseJson(
          meeting.decisions
        ).length > 0 && (

          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex items-center gap-3 mb-5">

              <CheckCircle2 className="w-5 h-5 text-slate-600" />

              <h2 className="text-xl font-semibold text-slate-900">
                Decisions
              </h2>

            </div>


            <div className="space-y-3">

              {parseJson(
                meeting.decisions
              ).map(
                (decision, index) => (

                  <div
                    key={index}
                    className="p-4 bg-slate-50 rounded-xl text-sm text-slate-700"
                  >
                    {decision}
                  </div>

                )
              )}

            </div>

          </section>

        )}


        {/* Transcript */}

        <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">

            <div>

              <div className="flex items-center gap-3">

                <FileAudio className="w-5 h-5 text-slate-600" />

                <h2 className="text-xl font-semibold text-slate-900">
                  Transcript
                </h2>

              </div>

              <p className="text-sm text-slate-500 mt-1">
                Search and filter the meeting conversation
              </p>

            </div>


            {transcriptSegments.length >
              0 && (
              <span className="text-sm text-slate-500">
                {filteredSegments.length} of{" "}
                {transcriptSegments.length}{" "}
                segments
              </span>
            )}

          </div>


          {!transcript ||
          transcriptSegments.length ===
            0 ? (

            <div className="text-center py-12">

              <FileText className="w-9 h-9 mx-auto text-slate-400" />

              <p className="text-slate-500 mt-3">
                Transcript is not available yet.
              </p>

            </div>

          ) : (

            <>

              {/* Transcript controls */}

              <div className="flex flex-col md:flex-row gap-3 mb-6">

                <div className="relative flex-1">

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


                <div className="relative">

                  <select
                    value={
                      selectedSpeaker
                    }
                    onChange={(e) =>
                      setSelectedSpeaker(
                        e.target.value
                      )
                    }
                    className="appearance-none w-full md:w-56 px-4 py-3 pr-10 border border-slate-200 rounded-xl bg-white outline-none"
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

                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                </div>

              </div>


              {/* Transcript list */}

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-[650px] overflow-y-auto">

                {filteredSegments.length ===
                0 ? (

                  <div className="p-10 text-center">

                    <Search className="w-8 h-8 mx-auto text-slate-400" />

                    <p className="text-slate-500 mt-3">
                      No transcript segments match your search.
                    </p>

                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedSpeaker(
                          "ALL"
                        );
                      }}
                      className="mt-4 text-sm font-medium text-slate-900 hover:underline"
                    >
                      Clear filters
                    </button>

                  </div>

                ) : (

                  filteredSegments.map(
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

                            <div className="w-16 shrink-0">

                              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">

                                <Play className="w-3 h-3" />

                                {formatTime(
                                  segment.start
                                )}

                              </span>

                            </div>


                            <div className="flex-1">

                              <div className="flex items-center gap-2 mb-2">

                                <span className="text-sm font-semibold text-slate-900">
                                  {speaker}
                                </span>

                                {segment.end !==
                                  undefined && (
                                  <span className="text-xs text-slate-400">
                                    →
                                    {" "}
                                    {formatTime(
                                      segment.end
                                    )}
                                  </span>
                                )}

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
                      );
                    }
                  )

                )}

              </div>

            </>

          )}

        </section>


        {/* Language */}

        {transcript?.language && (
          <div className="text-center text-sm text-slate-400 pb-8">

            Detected language:{" "}
            <span className="font-medium text-slate-500">
              {transcript.language}
            </span>

          </div>
        )}

      </main>

    </div>
  );
}

export default MeetingDetails;


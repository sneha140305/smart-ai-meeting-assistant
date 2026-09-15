import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MessageSquareText,
  Play,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Video,
  AlertCircle,
  RefreshCw,
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
  const [actionLoading, setActionLoading] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");

  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("ALL");

  const [updatingActionId, setUpdatingActionId] = useState(null);


  // ---------------------------------------------
  // Helpers
  // ---------------------------------------------

  const parseJson = (value, fallback = []) => {
    if (!value) return fallback;

    if (Array.isArray(value)) {
      return value;
    }

    try {
      const parsed = JSON.parse(value);

      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  };


  const formatTimestamp = (seconds) => {
    const totalSeconds = Math.max(
      0,
      Math.floor(Number(seconds) || 0)
    );

    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${minutes}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };


  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";

    return new Date(dateString).toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };


  const formatDuration = (duration) => {
    if (!duration) return "Unavailable";

    const totalSeconds = Number(duration);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }

    return `${minutes}m ${seconds}s`;
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


  const getSentimentPercentage = (value) => {
    const total =
      (analytics?.positive || 0) +
      (analytics?.negative || 0) +
      (analytics?.neutral || 0);

    if (!total) return 0;

    return Math.round((value / total) * 100);
  };


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


  const getInsightIcon = (type) => {
    if (type === "warning") {
      return (
        <AlertCircle className="w-5 h-5 text-amber-500" />
      );
    }

    if (type === "negative") {
      return (
        <AlertCircle className="w-5 h-5 text-red-500" />
      );
    }

    return (
      <CheckCircle2 className="w-5 h-5 text-green-600" />
    );
  };


  // ---------------------------------------------
  // Load Meeting Data
  // ---------------------------------------------

  const fetchMeetingData = async () => {
    try {
      setLoading(true);
      setError("");

      const meetingResponse = await api.get(
        `/meetings/${meetingId}`
      );

      const meetingData = meetingResponse.data;

      setMeeting(meetingData);

      // Analytics
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


      // Effectiveness score
      if (
        meetingData.effectiveness_score !== null &&
        meetingData.effectiveness_score !== undefined
      ) {
        setMeetingScore({
          score: meetingData.effectiveness_score,
          rating:
            meetingData.effectiveness_rating ||
            "",
        });
      } else {
        setMeetingScore(null);
      }


      // Stored AI insights
      setInsights(
        parseJson(
          meetingData.meeting_insights,
          []
        )
      );

      setRecommendations(
        parseJson(
          meetingData.meeting_recommendations,
          []
        )
      );


      // Transcript
      try {
        const transcriptResponse = await api.get(
          `/meetings/${meetingId}/transcript`
        );

        setTranscript(
          transcriptResponse.data
        );
      } catch (transcriptError) {
        console.log(
          "Transcript not available yet.",
          transcriptError
        );

        setTranscript(null);
      }


      // Action items
      try {
        setActionLoading(true);

        const actionResponse = await api.get(
          `/meetings/${meetingId}/action-items`
        );

        setActionItems(
          Array.isArray(actionResponse.data)
            ? actionResponse.data
            : []
        );
      } catch (actionError) {
        console.log(
          "Action items not available yet.",
          actionError
        );

        setActionItems([]);
      } finally {
        setActionLoading(false);
      }


      // Speaker analytics
      try {
        const speakerResponse = await api.get(
          `/meetings/${meetingId}/speaker-analytics`
        );

        setSpeakerAnalytics(
          Array.isArray(speakerResponse.data)
            ? speakerResponse.data
            : []
        );
      } catch (speakerError) {
        console.log(
          "Speaker analytics not available yet.",
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
          "Unable to load meeting."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchMeetingData();
  }, [meetingId]);


  // ---------------------------------------------
  // Transcript
  // ---------------------------------------------

  const transcriptSegments = useMemo(() => {
    if (!transcript) return [];

    if (Array.isArray(transcript.segments)) {
      return transcript.segments;
    }

    return parseJson(
      transcript.segments,
      []
    );
  }, [transcript]);


  const hasTranscript =
    transcriptSegments.length > 0;


  const speakers = useMemo(() => {
    if (!hasTranscript) return [];

    return [
      ...new Set(
        transcriptSegments.map(
          (segment) =>
            segment.speaker || "UNKNOWN"
        )
      ),
    ];
  }, [transcriptSegments, hasTranscript]);


  const filteredSegments = useMemo(() => {
    if (!hasTranscript) return [];

    const query =
      searchQuery.trim().toLowerCase();

    return transcriptSegments.filter(
      (segment) => {
        const text =
          segment.text?.toLowerCase() || "";

        const speaker =
          segment.speaker || "UNKNOWN";

        const matchesSearch =
          !query || text.includes(query);

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
    hasTranscript,
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
          <span key={index}>
            {part}
          </span>
        )
    );
  };


  // ---------------------------------------------
  // Action Items
  // ---------------------------------------------

  const updateActionItemStatus = async (
    actionItemId,
    status
  ) => {
    try {
      setUpdatingActionId(
        actionItemId
      );

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

      alert(
        err.response?.data?.detail ||
          "Failed to update action item."
      );
    } finally {
      setUpdatingActionId(null);
    }
  };


  const completedActionItems =
    actionItems.filter(
      (item) =>
        item.status === "completed"
    ).length;


  const actionCompletionRate =
    actionItems.length
      ? Math.round(
          (completedActionItems /
            actionItems.length) *
            100
        )
      : 0;


  // ---------------------------------------------
  // Dominant Speaker
  // ---------------------------------------------

  const dominantSpeaker =
    speakerAnalytics.length
      ? [...speakerAnalytics].sort(
          (a, b) =>
            (b.word_count || 0) -
            (a.word_count || 0)
        )[0]
      : null;


  // ---------------------------------------------
  // Processing
  // ---------------------------------------------

  const runTranscription = async () => {
    try {
      setProcessing(true);
      setProcessingStep(
        "Converting speech to text..."
      );
      setError("");

      await api.post(
        `/meetings/${meetingId}/transcribe`
      );

      await fetchMeetingData();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Transcription failed."
      );
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };


  const runDiarization = async () => {
    try {
      setProcessing(true);
      setProcessingStep(
        "Identifying speakers..."
      );
      setError("");

      await api.post(
        `/meetings/${meetingId}/diarize`
      );

      await fetchMeetingData();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Speaker identification failed."
      );
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };


  const runAnalysis = async () => {
    try {
      setProcessing(true);
      setProcessingStep(
        "Generating AI meeting insights..."
      );
      setError("");

      const response = await api.post(
        `/meetings/${meetingId}/analyze`
      );

      const result = response.data;

      // AI analysis
      if (result.summary) {
        setMeeting((current) => ({
          ...current,
          summary: result.summary,
        }));
      }

      // Score
      if (result.meeting_score) {
        setMeetingScore(
          result.meeting_score
        );
      }

      // Insights
      setInsights(
        result.insights || []
      );

      setRecommendations(
        result.recommendations || []
      );

      // Analytics
      if (result.analytics) {
        setAnalytics({
          totalWords:
            result.analytics.total_words ||
            0,

          speakerCount:
            result.analytics.speaker_count ||
            0,

          positive:
            result.analytics.positive_sentiment ||
            0,

          negative:
            result.analytics.negative_sentiment ||
            0,

          neutral:
            result.analytics.neutral_sentiment ||
            0,
        });
      }

      await fetchMeetingData();

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Meeting analysis failed."
      );
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };


  // ---------------------------------------------
  // Pipeline Button
  // ---------------------------------------------

  const getPrimaryAction = () => {
    if (!meeting) return null;

    if (
      meeting.status === "audio_ready"
    ) {
      return {
        label: "Transcribe Meeting",
        action: runTranscription,
      };
    }

    if (
      meeting.status === "transcribed"
    ) {
      const hasSpeakers =
        hasTranscript &&
        transcriptSegments.some(
          (segment) => segment.speaker
        );

      if (!hasSpeakers) {
        return {
          label: "Identify Speakers",
          action: runDiarization,
        };
      }

      return {
        label: "Analyze Meeting",
        action: runAnalysis,
      };
    }

    if (
      meeting.status === "diarization_failed"
    ) {
      return {
        label: "Retry Speaker Identification",
        action: runDiarization,
      };
    }

    if (
      meeting.status === "analysis_failed"
    ) {
      return {
        label: "Retry AI Analysis",
        action: runAnalysis,
      };
    }

    return null;
  };


  const primaryAction =
    getPrimaryAction();


  // ---------------------------------------------
  // Loading
  // ---------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">

        <div className="text-center">

          <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto" />

          <p className="text-slate-500 mt-3">
            Loading meeting...
          </p>

        </div>

      </div>
    );
  }


  // ---------------------------------------------
  // Error / No Meeting
  // ---------------------------------------------

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50">

        <div className="max-w-5xl mx-auto px-6 py-8">

          <button
            onClick={() =>
              navigate("/dashboard")
            }
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          <div className="bg-white border border-red-200 rounded-2xl p-10 text-center mt-8">

            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />

            <h2 className="text-xl font-semibold text-slate-900 mt-4">
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


  // ---------------------------------------------
  // Main UI
  // ---------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}

      <header className="bg-white border-b border-slate-200">

        <div className="max-w-7xl mx-auto px-6 py-4">

          <button
            onClick={() =>
              navigate("/dashboard")
            }
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>


          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">

            <div>

              <div className="flex items-center gap-3 flex-wrap">

                <h1 className="text-2xl font-bold text-slate-900">
                  {meeting.title ||
                    "Untitled Meeting"}
                </h1>

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

              <p className="text-sm text-slate-500 mt-2">
                {meeting.file_name}
              </p>

            </div>


            {primaryAction && !processing && (
              <button
                onClick={primaryAction.action}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition"
              >
                <Play className="w-4 h-4" />
                {primaryAction.label}
              </button>
            )}

          </div>

        </div>

      </header>


      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Error */}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">

            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />

            <p className="text-sm text-red-700">
              {error}
            </p>

          </div>
        )}


        {/* Processing */}

        {processing && (
          <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <Loader2 className="w-5 h-5 animate-spin text-slate-700" />

              <div>

                <p className="font-medium text-slate-900">
                  {processingStep}
                </p>

                <p className="text-sm text-slate-500 mt-1">
                  This may take some time depending on
                  the length of the recording.
                </p>

              </div>

            </div>

          </div>
        )}


        {/* Meeting Metadata */}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-slate-100 rounded-xl">
                <CalendarDays className="w-5 h-5 text-slate-600" />
              </div>

              <div>

                <p className="text-xs text-slate-500">
                  Created
                </p>

                <p className="font-medium text-slate-900 mt-1">
                  {formatDate(
                    meeting.created_at
                  )}
                </p>

              </div>

            </div>

          </div>


          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-slate-100 rounded-xl">
                <Clock3 className="w-5 h-5 text-slate-600" />
              </div>

              <div>

                <p className="text-xs text-slate-500">
                  Duration
                </p>

                <p className="font-medium text-slate-900 mt-1">
                  {formatDuration(
                    meeting.duration
                  )}
                </p>

              </div>

            </div>

          </div>


          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-slate-100 rounded-xl">
                <FileText className="w-5 h-5 text-slate-600" />
              </div>

              <div>

                <p className="text-xs text-slate-500">
                  File
                </p>

                <p className="font-medium text-slate-900 mt-1 truncate max-w-[220px]">
                  {meeting.file_name}
                </p>

              </div>

            </div>

          </div>

        </section>


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

                <p className="text-sm text-slate-500 mt-2 max-w-2xl">
                  Overall meeting quality based on
                  participation, sentiment, action items,
                  transcript quality and efficiency.
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
                meetingScore.breakdown.participation,
                25,
              ],
              [
                "Sentiment",
                meetingScore.breakdown.sentiment,
                20,
              ],
              [
                "Action Items",
                meetingScore.breakdown.action_items,
                25,
              ],
              [
                "Transcript",
                meetingScore.breakdown.transcript_quality,
                20,
              ],
              [
                "Efficiency",
                meetingScore.breakdown.efficiency,
                10,
              ],
            ].map(
              ([label, value, max]) => {

                const percentage =
                  max > 0
                    ? Math.round(
                        (value / max) *
                          100
                      )
                    : 0;

                return (
                  <div
                    key={label}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
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
                (insight, index) => (
                  <div
                    key={index}
                    className="border border-slate-200 rounded-xl p-5"
                  >

                    <div className="flex items-start gap-3">

                      <div className="mt-1">
                        {getInsightIcon(
                          insight.type
                        )}
                      </div>

                      <div>

                        <h3 className="font-semibold text-slate-900">
                          {insight.title ||
                            "Meeting Insight"}
                        </h3>

                        <p className="text-sm text-slate-600 mt-2 leading-6">
                          {insight.description ||
                            ""}
                        </p>

                      </div>

                    </div>

                  </div>
                )
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
                    {analytics?.totalWords || 0}
                  </p>

                </div>

                <div className="p-3 bg-slate-100 rounded-xl">
                  <MessageSquareText className="w-6 h-6 text-slate-600" />
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
                    {analytics?.speakerCount || 0}
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

                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {analytics?.positive || 0}
                  </p>

                </div>

                <div className="p-3 bg-slate-100 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
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


        {/* Sentiment Overview */}

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

                <span className="font-semibold text-green-600">
                  {analytics?.positive || 0}
                </span>

              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">

                <div
                  className="bg-green-500 h-3 rounded-full"
                  style={{
                    width: `${getSentimentPercentage(
                      analytics?.positive || 0
                    )}%`,
                  }}
                />

              </div>

              <p className="text-xs text-slate-500 mt-2">
                {getSentimentPercentage(
                  analytics?.positive || 0
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

                <span className="font-semibold text-red-600">
                  {analytics?.negative || 0}
                </span>

              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">

                <div
                  className="bg-red-500 h-3 rounded-full"
                  style={{
                    width: `${getSentimentPercentage(
                      analytics?.negative || 0
                    )}%`,
                  }}
                />

              </div>

              <p className="text-xs text-slate-500 mt-2">
                {getSentimentPercentage(
                  analytics?.negative || 0
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

                <span className="font-semibold text-slate-600">
                  {analytics?.neutral || 0}
                </span>

              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">

                <div
                  className="bg-slate-400 h-3 rounded-full"
                  style={{
                    width: `${getSentimentPercentage(
                      analytics?.neutral || 0
                    )}%`,
                  }}
                />

              </div>

              <p className="text-xs text-slate-500 mt-2">
                {getSentimentPercentage(
                  analytics?.neutral || 0
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

            <div className="text-center py-10">

              <Users className="w-8 h-8 text-slate-300 mx-auto" />

              <p className="text-slate-500 mt-3">
                Speaker analytics are not available yet.
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Run speaker identification and analysis first.
              </p>

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

                        <div className="flex gap-3">

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
                            {minutes}m {seconds}s
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

                  <TrendingUp className="w-5 h-5 text-slate-700 mt-0.5 shrink-0" />

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


        {/* Action Items */}

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">

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
                {actionItems.length} task
                {actionItems.length !== 1
                  ? "s"
                  : ""}
              </p>

              {actionItems.length > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  {actionCompletionRate}% completed
                </p>
              )}

            </div>

          </div>


          {actionLoading ? (

            <div className="py-10 text-center">

              <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-500" />

              <p className="text-sm text-slate-500 mt-3">
                Loading action items...
              </p>

            </div>

          ) : actionItems.length === 0 ? (

            <div className="text-center py-10">

              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />

              <p className="text-slate-500 mt-3">
                No action items found.
              </p>

            </div>

          ) : (

            <div className="space-y-4">

              {actionItems.map(
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
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <Clock3 className="w-5 h-5 text-amber-500" />
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


                      <div className="flex items-center gap-2">

                        {updatingActionId ===
                          item.id && (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                        )}

                        <select
                          value={
                            item.status ||
                            "pending"
                          }
                          disabled={
                            updatingActionId ===
                            item.id
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


        {/* Summary */}

        {meeting.summary && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex items-center gap-3 mb-5">

              <div className="p-3 bg-slate-100 rounded-xl">
                <FileText className="w-5 h-5 text-slate-700" />
              </div>

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  Meeting Summary
                </h2>

                <p className="text-sm text-slate-500">
                  AI-generated overview
                </p>

              </div>

            </div>


            <p className="text-slate-700 leading-7 whitespace-pre-wrap">
              {meeting.summary}
            </p>

          </section>
        )}


        {/* Key Points */}

        {parseJson(
          meeting.key_points,
          []
        ).length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <h2 className="text-xl font-semibold text-slate-900 mb-5">
              Key Points
            </h2>

            <div className="space-y-3">

              {parseJson(
                meeting.key_points,
                []
              ).map(
                (point, index) => (
                  <div
                    key={index}
                    className="flex gap-3"
                  >

                    <span className="w-6 h-6 shrink-0 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
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
          meeting.decisions,
          []
        ).length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <h2 className="text-xl font-semibold text-slate-900 mb-5">
              Decisions
            </h2>

            <div className="space-y-3">

              {parseJson(
                meeting.decisions,
                []
              ).map(
                (decision, index) => (
                  <div
                    key={index}
                    className="flex gap-3"
                  >

                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />

                    <p className="text-sm text-slate-700 leading-6">
                      {decision}
                    </p>

                  </div>
                )
              )}

            </div>

          </section>
        )}


        {/* Transcript */}

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          <div className="p-6 border-b border-slate-200">

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  Transcript
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Search and explore the meeting conversation
                </p>

              </div>


              {hasTranscript && (
                <div className="text-sm text-slate-500">
                  Showing{" "}
                  {filteredSegments.length} of{" "}
                  {transcriptSegments.length} segments
                </div>
              )}

            </div>


            {hasTranscript && (
              <div className="flex flex-col md:flex-row gap-3 mt-5">

                {/* Search */}

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


                {/* Speaker */}

                <select
                  value={selectedSpeaker}
                  onChange={(e) =>
                    setSelectedSpeaker(
                      e.target.value
                    )
                  }
                  className="md:w-56 px-4 py-3 border border-slate-200 rounded-xl bg-white outline-none"
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
            )}

          </div>


          {!hasTranscript ? (

            <div className="p-12 text-center">

              <FileText className="w-10 h-10 text-slate-300 mx-auto" />

              <h3 className="font-semibold text-slate-900 mt-4">
                Transcript not available
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                Transcribe the meeting to view its conversation.
              </p>

            </div>

          ) : filteredSegments.length === 0 ? (

            <div className="p-12 text-center">

              <Search className="w-8 h-8 text-slate-300 mx-auto" />

              <p className="text-slate-500 mt-3">
                No transcript segments match your filters.
              </p>

              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSpeaker("ALL");
                }}
                className="mt-4 text-sm font-medium text-slate-900 hover:underline"
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

                        {/* Timestamp */}

                        <button
                          type="button"
                          title="Jump to timestamp"
                          className="shrink-0 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
                        >
                          <Clock3 className="w-4 h-4" />
                          {formatTimestamp(
                            segment.start
                          )}
                        </button>


                        {/* Content */}

                        <div className="min-w-0">

                          <div className="flex items-center gap-2 mb-2">

                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">

                              <User className="w-3.5 h-3.5" />

                              {speaker}

                            </span>

                            <span className="text-xs text-slate-400">
                              →
                            </span>

                            <span className="text-xs text-slate-400">
                              {formatTimestamp(
                                segment.end
                              )}
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
                  );
                }
              )}

            </div>

          )}

        </section>


        {/* Bottom Refresh */}

        <div className="flex justify-center mt-8">

          <button
            onClick={fetchMeetingData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >

            <RefreshCw
              className={`w-4 h-4 ${
                loading
                  ? "animate-spin"
                  : ""
              }`}
            />

            Refresh Meeting Data

          </button>

        </div>

      </main>

    </div>
  );
}

export default MeetingDetails;

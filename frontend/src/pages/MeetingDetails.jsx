import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileAudio,
  Loader2,
  MessageSquareText,
  Play,
  Search,
  Smile,
  Sparkles,
  Users,
  User,
  XCircle,
} from "lucide-react";
import api from "../services/api";

export default function MeetingDetails() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("ALL");

  useEffect(() => {
    loadMeetingData();
  }, [meetingId]);

  const loadMeetingData = async () => {
    try {
      setLoading(true);
      setError("");

      const meetingResponse = await api.get(
        `/meetings/${meetingId}`
      );

      const meetingData = meetingResponse.data;

      setMeeting(meetingData);

      setAnalytics({
        totalWords: meetingData.total_words || 0,
        speakerCount: meetingData.speaker_count || 0,
        positive: meetingData.positive_sentiment || 0,
        negative: meetingData.negative_sentiment || 0,
        neutral: meetingData.neutral_sentiment || 0,
      });

      try {
        const transcriptResponse = await api.get(
          `/meetings/${meetingId}/transcript`
        );

        setTranscript(transcriptResponse.data);
      } catch (transcriptError) {
        console.log("Transcript not available yet.");
        setTranscript(null);
      }

      try {
        const actionResponse = await api.get(
          `/meetings/${meetingId}/action-items`
        );

        setActionItems(actionResponse.data || []);
      } catch (actionError) {
        console.log("Action items not available yet.");
        setActionItems([]);
      }
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Failed to load meeting details."
      );
    } finally {
      setLoading(false);
    }
  };

  const runPipeline = async (endpoint, successMessage) => {
    try {
      setProcessing(true);
      setError("");

      await api.post(`/meetings/${meetingId}/${endpoint}`);

      await loadMeetingData();

      alert(successMessage);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          `Failed to ${endpoint} the meeting.`
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleTranscribe = () => {
    runPipeline(
      "transcribe",
      "Transcription completed successfully."
    );
  };

  const handleDiarize = () => {
    runPipeline(
      "diarize",
      "Speaker diarization completed successfully."
    );
  };

  const handleAnalyze = () => {
    runPipeline(
      "analyze",
      "AI meeting analysis completed successfully."
    );
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

      const response = await api.get(
        `/meetings/${meetingId}/action-items`
      );

      setActionItems(response.data || []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Failed to update action item."
      );
    }
  };

  const getSentimentPercentage = (value) => {
    const total =
      (analytics?.positive || 0) +
      (analytics?.negative || 0) +
      (analytics?.neutral || 0);

    if (!total) return 0;

    return Math.round((value / total) * 100);
  };

  const parseJsonField = (value) => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value;
    }

    try {
      const parsed = JSON.parse(value);

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const keyPoints = useMemo(() => {
    return parseJsonField(meeting?.key_points);
  }, [meeting]);

  const decisions = useMemo(() => {
    return parseJsonField(meeting?.decisions);
  }, [meeting]);

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

    const normalizedSearch =
      searchQuery.trim().toLowerCase();

    return transcript.segments.filter((segment) => {
      const text =
        segment.text?.toLowerCase() || "";

      const speaker =
        segment.speaker || "UNKNOWN";

      const matchesSearch =
        !normalizedSearch ||
        text.includes(normalizedSearch);

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

  const completedActionItems = actionItems.filter(
    (item) => item.status === "completed"
  ).length;

  const actionCompletionRate = actionItems.length
    ? Math.round(
        (completedActionItems / actionItems.length) * 100
      )
    : 0;

  const formatTimestamp = (seconds) => {
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

  const highlightText = (text) => {
    if (!searchQuery.trim()) {
      return text;
    }

    const query = searchQuery.trim();

    const parts = text.split(
      new RegExp(`(${escapeRegExp(query)})`, "gi")
    );

    return parts.map((part, index) => {
      if (
        part.toLowerCase() ===
        query.toLowerCase()
      ) {
        return (
          <mark
            key={index}
            className="bg-yellow-200 text-slate-900 rounded px-0.5"
          >
            {part}
          </mark>
        );
      }

      return part;
    });
  };

  const escapeRegExp = (value) => {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  };

  const getStatusClass = (status) => {
    const normalized =
      status?.toLowerCase();

    if (normalized === "completed") {
      return "bg-green-100 text-green-700";
    }

    if (
      normalized === "processing" ||
      normalized === "preprocessing" ||
      normalized === "transcribing" ||
      normalized === "diarizing" ||
      normalized === "analyzing"
    ) {
      return "bg-blue-100 text-blue-700";
    }

    if (
      normalized === "analysis_failed" ||
      normalized === "diarization_failed"
    ) {
      return "bg-red-100 text-red-700";
    }

    if (normalized === "transcribed") {
      return "bg-purple-100 text-purple-700";
    }

    if (normalized === "audio_ready") {
      return "bg-amber-100 text-amber-700";
    }

    return "bg-slate-100 text-slate-700";
  };

  const isCompleted =
    meeting?.status === "completed";

  const canTranscribe =
    meeting?.status === "audio_ready";

  const canDiarize =
    meeting?.status === "transcribed" &&
    hasTranscript;

  const canAnalyze =
    meeting?.status === "transcribed" &&
    hasTranscript;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading meeting...
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />

          <h2 className="text-xl font-semibold text-slate-900">
            Meeting not found
          </h2>

          <p className="text-slate-500 mt-2">
            We could not find this meeting.
          </p>

          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

            <div className="flex items-center gap-4">

              <button
                onClick={() =>
                  navigate("/dashboard")
                }
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {meeting.title}
                </h1>

                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500">

                  <span className="flex items-center gap-1">
                    <FileAudio className="w-4 h-4" />
                    {meeting.file_name}
                  </span>

                  {meeting.duration && (
                    <span>
                      {formatTimestamp(
                        meeting.duration
                      )}
                    </span>
                  )}

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClass(
                      meeting.status
                    )}`}
                  >
                    {meeting.status}
                  </span>

                </div>
              </div>

            </div>

          </div>

        </div>
      </header>


      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />

            <p className="text-sm">
              {error}
            </p>
          </div>
        )}


        {/* Processing Controls */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Meeting Processing
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Process your recording through transcription,
                speaker identification, and AI analysis.
              </p>
            </div>


            <div className="flex flex-wrap gap-3">

              <button
                onClick={handleTranscribe}
                disabled={
                  processing ||
                  !canTranscribe
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}

                Transcribe
              </button>


              <button
                onClick={handleDiarize}
                disabled={
                  processing ||
                  !canDiarize
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Users className="w-4 h-4" />
                Identify Speakers
              </button>


              <button
                onClick={handleAnalyze}
                disabled={
                  processing ||
                  !canAnalyze
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}

                Analyze with AI
              </button>

            </div>

          </div>

        </section>


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

                <div className="p-3 bg-blue-50 rounded-xl">
                  <MessageSquareText className="w-6 h-6 text-blue-600" />
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

                <div className="p-3 bg-purple-50 rounded-xl">
                  <Users className="w-6 h-6 text-purple-600" />
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
                    {analytics?.positive || 0}
                  </p>
                </div>

                <div className="p-3 bg-green-50 rounded-xl">
                  <Smile className="w-6 h-6 text-green-600" />
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

                <div className="p-3 bg-amber-50 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-amber-600" />
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
            <div className="border border-green-100 rounded-xl p-5">

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
                  className="bg-green-500 h-3 rounded-full transition-all"
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
            <div className="border border-red-100 rounded-xl p-5">

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
                  className="bg-red-500 h-3 rounded-full transition-all"
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
                  className="bg-slate-400 h-3 rounded-full transition-all"
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


        {/* AI Summary */}
        {meeting.summary && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex items-center gap-3 mb-5">

              <div className="p-3 bg-purple-50 rounded-xl">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  AI Summary
                </h2>

                <p className="text-sm text-slate-500">
                  Automatically generated meeting summary
                </p>
              </div>

            </div>

            <p className="text-slate-700 leading-7 whitespace-pre-wrap">
              {meeting.summary}
            </p>

          </section>
        )}


        {/* Key Points + Decisions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* Key Points */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

            <h2 className="text-xl font-semibold text-slate-900 mb-5">
              Key Points
            </h2>

            {keyPoints.length === 0 ? (
              <p className="text-slate-500 text-sm">
                No key points available yet.
              </p>
            ) : (
              <ul className="space-y-3">

                {keyPoints.map(
                  (point, index) => (
                    <li
                      key={index}
                      className="flex gap-3 text-slate-700"
                    >
                      <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {index + 1}
                      </span>

                      <span>
                        {point}
                      </span>
                    </li>
                  )
                )}

              </ul>
            )}

          </section>


          {/* Decisions */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

            <h2 className="text-xl font-semibold text-slate-900 mb-5">
              Decisions
            </h2>

            {decisions.length === 0 ? (
              <p className="text-slate-500 text-sm">
                No decisions available yet.
              </p>
            ) : (
              <ul className="space-y-3">

                {decisions.map(
                  (decision, index) => (
                    <li
                      key={index}
                      className="flex gap-3 text-slate-700"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />

                      <span>
                        {decision}
                      </span>
                    </li>
                  )
                )}

              </ul>
            )}

          </section>

        </div>


        {/* Action Items */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">

            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Action Items
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Tasks identified from the meeting
              </p>
            </div>

            <div className="flex items-center gap-4 text-sm">

              <span className="text-slate-500">
                {actionItems.length} tasks
              </span>

              {actionItems.length > 0 && (
                <span className="font-medium text-green-600">
                  {actionCompletionRate}% completed
                </span>
              )}

            </div>

          </div>


          {actionItems.length === 0 ? (
            <div className="text-center py-10">

              <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />

              <p className="text-slate-500">
                No action items found.
              </p>

            </div>
          ) : (
            <div className="space-y-4">

              {actionItems.map((item) => (

                <div
                  key={item.id}
                  className="border border-slate-200 rounded-xl p-4 hover:shadow-sm transition"
                >

                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

                    <div className="flex gap-3">

                      <div className="mt-1">

                        {item.status === "completed" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Clock3 className="w-5 h-5 text-amber-500" />
                        )}

                      </div>


                      <div>

                        <p
                          className={`font-medium ${
                            item.status === "completed"
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
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
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

              ))}

            </div>
          )}

        </section>


        {/* Speaker Analytics */}
        {meeting.speaker_analytics &&
          Array.isArray(
            meeting.speaker_analytics
          ) &&
          meeting.speaker_analytics.length > 0 && (

          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">

            <div className="flex items-center gap-3 mb-6">

              <div className="p-3 bg-purple-50 rounded-xl">
                <Users className="w-6 h-6 text-purple-600" />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Speaker Analytics
                </h2>

                <p className="text-sm text-slate-500">
                  Participation and speaking distribution
                </p>
              </div>

            </div>


            <div className="space-y-4">

              {meeting.speaker_analytics.map(
                (speaker, index) => {

                  const percentage =
                    speaker.percentage ||
                    speaker.speaking_percentage ||
                    0;

                  return (
                    <div
                      key={index}
                      className="border border-slate-200 rounded-xl p-4"
                    >

                      <div className="flex items-center justify-between mb-3">

                        <div className="flex items-center gap-3">

                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-600" />
                          </div>

                          <div>

                            <p className="font-medium text-slate-900">
                              {speaker.speaker ||
                                "Unknown Speaker"}
                            </p>

                            <p className="text-xs text-slate-500">
                              {speaker.word_count ||
                                0}{" "}
                              words
                            </p>

                          </div>

                        </div>


                        <span className="font-semibold text-slate-700">
                          {percentage}%
                        </span>

                      </div>


                      <div className="w-full bg-slate-100 rounded-full h-2.5">

                        <div
                          className="bg-purple-500 h-2.5 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              percentage
                            )}%`,
                          }}
                        />

                      </div>


                      {speaker.speaking_time != null && (
                        <p className="text-xs text-slate-500 mt-2">
                          Speaking time:{" "}
                          {formatTimestamp(
                            speaker.speaking_time
                          )}
                        </p>
                      )}

                    </div>
                  );
                }
              )}

            </div>

          </section>
        )}


        {/* Transcript */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          <div className="p-6 border-b border-slate-200">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

              <div>

                <h2 className="text-xl font-semibold text-slate-900">
                  Transcript
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Search and filter the conversation
                </p>

              </div>


              {hasTranscript && (
                <div className="text-sm text-slate-500">
                  Showing{" "}
                  {filteredSegments.length}{" "}
                  of{" "}
                  {transcript.segments.length}{" "}
                  segments
                </div>
              )}

            </div>


            {hasTranscript && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">

                {/* Search */}
                <div className="relative">

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


                {/* Speaker Filter */}
                <select
                  value={selectedSpeaker}
                  onChange={(e) =>
                    setSelectedSpeaker(
                      e.target.value
                    )
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
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

              </div>
            )}

          </div>


          {!hasTranscript ? (

            <div className="p-12 text-center">

              <MessageSquareText className="w-12 h-12 text-slate-300 mx-auto mb-4" />

              <h3 className="text-lg font-medium text-slate-700">
                Transcript not available
              </h3>

              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                Transcribe the meeting first to generate
                a searchable transcript.
              </p>

            </div>

          ) : filteredSegments.length === 0 ? (

            <div className="p-12 text-center">

              <Search className="w-10 h-10 text-slate-300 mx-auto mb-4" />

              <h3 className="text-lg font-medium text-slate-700">
                No matching segments
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                Try changing your search or speaker filter.
              </p>

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

                      <div className="flex items-start gap-4">

                        {/* Timestamp */}
                        <button
                          type="button"
                          className="flex-shrink-0 text-xs font-mono text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100"
                          title="Timestamp"
                        >
                          {formatTimestamp(
                            segment.start
                          )}
                        </button>


                        <div className="min-w-0 flex-1">

                          <div className="flex flex-wrap items-center gap-2 mb-2">

                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">

                              <User className="w-3.5 h-3.5" />

                              {speaker}

                            </span>

                            {segment.end != null && (
                              <span className="text-xs text-slate-400">
                                {formatTimestamp(
                                  segment.start
                                )}{" "}
                                –{" "}
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


        {/* Footer spacing */}
        <div className="h-10" />

      </main>

    </div>
  );
}


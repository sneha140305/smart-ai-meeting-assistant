import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Pause,
  FileAudio,
  Brain,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Users,
  MessageSquare,
  BarChart3,
  Search,
  Filter,
  Download,
  Lightbulb,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  Circle,
  Loader2,
  RefreshCw,
  CalendarDays,
  FileText,
  Volume2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../services/api";

export default function MeetingDetails() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  // ---------------------------------------------------------
  // CORE STATE
  // ---------------------------------------------------------

  const [meeting, setMeeting] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [actionItems, setActionItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // ---------------------------------------------------------
  // PROCESSING STATE
  // ---------------------------------------------------------

  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");

  // ---------------------------------------------------------
  // TRANSCRIPT STATE
  // ---------------------------------------------------------

  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState("all");

  // ---------------------------------------------------------
  // ACTION ITEM STATE
  // ---------------------------------------------------------

  const [actionFilter, setActionFilter] = useState("all");

  // ---------------------------------------------------------
  // AUDIO STATE
  // ---------------------------------------------------------

  const [audioUrl, setAudioUrl] = useState("");
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const audioRef = useRef(null);

  // ---------------------------------------------------------
  // TRANSCRIPT REFS
  // ---------------------------------------------------------

  const transcriptRefs = useRef([]);
  const lastActiveSegment = useRef(-1);

  // ---------------------------------------------------------
  // UI STATE
  // ---------------------------------------------------------

  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    keyPoints: true,
    decisions: true,
    actions: true,
    analytics: true,
    speakers: true,
    transcript: true,
    insights: true,
    recommendations: true,
  });

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";

    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "N/A";
    }
  };

  const formatTimestamp = (seconds) => {
    if (!Number.isFinite(seconds)) return "00:00";

    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return "N/A";

    const totalSeconds = Math.floor(seconds);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  };

  const safeJsonParse = (value, fallback = []) => {
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

  const getStatusLabel = (status) => {
    const labels = {
      uploaded: "Uploaded",
      audio_ready: "Audio Ready",
      transcribing: "Transcribing",
      transcribed: "Transcribed",
      diarizing: "Identifying Speakers",
      analyzing: "Analyzing",
      completed: "Completed",
      processing: "Processing",
      failed: "Failed",
      transcription_failed: "Transcription Failed",
      diarization_failed: "Diarization Failed",
      analysis_failed: "Analysis Failed",
    };

    return labels[status] || status || "Unknown";
  };

  const getStatusClass = (status) => {
    if (status === "completed") {
      return "bg-green-100 text-green-700 border-green-200";
    }

    if (
      [
        "transcribing",
        "diarizing",
        "analyzing",
        "processing",
      ].includes(status)
    ) {
      return "bg-blue-100 text-blue-700 border-blue-200";
    }

    if (
      [
        "failed",
        "transcription_failed",
        "diarization_failed",
        "analysis_failed",
      ].includes(status)
    ) {
      return "bg-red-100 text-red-700 border-red-200";
    }

    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  const toggleSection = (section) => {
    setExpandedSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }));
  };

  // ---------------------------------------------------------
  // FETCH MEETING
  // ---------------------------------------------------------

  const loadMeeting = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const response = await api.get(`/meetings/${meetingId}`);

      setMeeting(response.data);
    } catch (err) {
      console.error("Failed to load meeting:", err);

      setError(
        err.response?.data?.detail ||
          "Failed to load meeting details."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ---------------------------------------------------------
  // FETCH TRANSCRIPT
  // ---------------------------------------------------------

  const loadTranscript = async () => {
    try {
      const response = await api.get(
        `/meetings/${meetingId}/transcript`
      );

      setTranscript(response.data);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("Failed to load transcript:", err);
      }

      setTranscript(null);
    }
  };

  // ---------------------------------------------------------
  // FETCH ACTION ITEMS
  // ---------------------------------------------------------

  const loadActionItems = async () => {
    try {
      const response = await api.get(
        `/meetings/${meetingId}/action-items`
      );

      setActionItems(response.data || []);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("Failed to load action items:", err);
      }

      setActionItems([]);
    }
  };

  // ---------------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------------

  useEffect(() => {
    const loadData = async () => {
      await loadMeeting();
      await Promise.all([
        loadTranscript(),
        loadActionItems(),
      ]);
    };

    loadData();
  }, [meetingId]);

  // ---------------------------------------------------------
  // AUDIO LOAD
  // ---------------------------------------------------------

  const loadAudio = async () => {
    try {
      setAudioLoading(true);

      const response = await api.get(
        `/meetings/${meetingId}/audio`,
        {
          responseType: "blob",
        }
      );

      const url = URL.createObjectURL(response.data);

      setAudioUrl(url);
    } catch (err) {
      console.error("Failed to load audio:", err);
    } finally {
      setAudioLoading(false);
    }
  };

  useEffect(() => {
    loadAudio();

    return () => {
      setAudioUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }

        return "";
      });
    };
  }, [meetingId]);

  // ---------------------------------------------------------
  // AUDIO EVENTS
  // ---------------------------------------------------------

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;

    setAudioCurrentTime(audioRef.current.currentTime);
  };

  const handleAudioLoaded = () => {
    if (!audioRef.current) return;

    setAudioDuration(audioRef.current.duration || 0);
  };

  const handleAudioPlay = () => {
    setAudioPlaying(true);
  };

  const handleAudioPause = () => {
    setAudioPlaying(false);
  };

  const handleAudioEnded = () => {
    setAudioPlaying(false);
  };

  // ---------------------------------------------------------
  // PLAY / PAUSE
  // ---------------------------------------------------------

  const toggleAudio = async () => {
    if (!audioRef.current) return;

    try {
      if (audioRef.current.paused) {
        await audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    } catch (err) {
      console.error("Audio playback failed:", err);
    }
  };

  // ---------------------------------------------------------
  // JUMP TO TIMESTAMP
  // ---------------------------------------------------------

  const jumpToTimestamp = (seconds) => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = seconds;
    setAudioCurrentTime(seconds);

    audioRef.current
      .play()
      .catch((err) => console.error("Playback failed:", err));
  };

  // ---------------------------------------------------------
  // ACTIVE TRANSCRIPT SEGMENT
  // ---------------------------------------------------------

  const transcriptSegments = useMemo(() => {
    if (!transcript?.segments) return [];

    if (Array.isArray(transcript.segments)) {
      return transcript.segments;
    }

    return safeJsonParse(transcript.segments, []);
  }, [transcript]);

  const speakers = useMemo(() => {
    const uniqueSpeakers = new Set();

    transcriptSegments.forEach((segment) => {
      if (segment.speaker) {
        uniqueSpeakers.add(segment.speaker);
      }
    });

    return Array.from(uniqueSpeakers);
  }, [transcriptSegments]);

  const activeSegmentIndex = useMemo(() => {
    if (!transcriptSegments.length) return -1;

    return transcriptSegments.findIndex(
      (segment) =>
        audioCurrentTime >= Number(segment.start || 0) &&
        audioCurrentTime < Number(segment.end || 0)
    );
  }, [audioCurrentTime, transcriptSegments]);

  // ---------------------------------------------------------
  // AUTO SCROLL ACTIVE TRANSCRIPT
  // ---------------------------------------------------------

  useEffect(() => {
    if (
      activeSegmentIndex === -1 ||
      activeSegmentIndex === lastActiveSegment.current
    ) {
      return;
    }

    const element =
      transcriptRefs.current[activeSegmentIndex];

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    lastActiveSegment.current = activeSegmentIndex;
  }, [activeSegmentIndex]);

  // ---------------------------------------------------------
  // FILTERED TRANSCRIPT
  // ---------------------------------------------------------

  const filteredTranscript = useMemo(() => {
    const search = transcriptSearch
      .trim()
      .toLowerCase();

    return transcriptSegments
      .map((segment, index) => ({
        ...segment,
        originalIndex: index,
      }))
      .filter((segment) => {
        const matchesSearch =
          !search ||
          String(segment.text || "")
            .toLowerCase()
            .includes(search);

        const matchesSpeaker =
          speakerFilter === "all" ||
          segment.speaker === speakerFilter;

        return matchesSearch && matchesSpeaker;
      });
  }, [
    transcriptSegments,
    transcriptSearch,
    speakerFilter,
  ]);

  // ---------------------------------------------------------
  // TRANSCRIBE
  // ---------------------------------------------------------

  const handleTranscribe = async () => {
    try {
      setProcessing(true);
      setProcessingStep("Transcribing audio...");
      setError("");

      await api.post(
        `/meetings/${meetingId}/transcribe`
      );

      await Promise.all([
        loadMeeting(false),
        loadTranscript(),
      ]);
    } catch (err) {
      console.error("Transcription failed:", err);

      setError(
        err.response?.data?.detail ||
          "Transcription failed."
      );
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  // ---------------------------------------------------------
  // DIARIZATION
  // ---------------------------------------------------------

  const handleDiarize = async () => {
    try {
      setProcessing(true);
      setProcessingStep("Identifying speakers...");
      setError("");

      await api.post(
        `/meetings/${meetingId}/diarize`
      );

      await Promise.all([
        loadMeeting(false),
        loadTranscript(),
      ]);
    } catch (err) {
      console.error("Diarization failed:", err);

      setError(
        err.response?.data?.detail ||
          "Speaker identification failed."
      );
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  // ---------------------------------------------------------
  // AI ANALYSIS
  // ---------------------------------------------------------

  const handleAnalyze = async () => {
    try {
      setProcessing(true);
      setProcessingStep(
        "Analyzing meeting with AI..."
      );
      setError("");

      await api.post(
        `/meetings/${meetingId}/analyze`
      );

      await Promise.all([
        loadMeeting(false),
        loadTranscript(),
        loadActionItems(),
      ]);
    } catch (err) {
      console.error("Analysis failed:", err);

      setError(
        err.response?.data?.detail ||
          "AI analysis failed."
      );
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  };

  // ---------------------------------------------------------
  // REFRESH
  // ---------------------------------------------------------

  const handleRefresh = async () => {
    await Promise.all([
      loadMeeting(false),
      loadTranscript(),
      loadActionItems(),
    ]);
  };

  // ---------------------------------------------------------
  // ACTION ITEM UPDATE
  // ---------------------------------------------------------

  const updateActionItem = async (
    actionItemId,
    updates
  ) => {
    try {
      await api.patch(
        `/meetings/action-items/${actionItemId}`,
        updates
      );

      await loadActionItems();
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

  // ---------------------------------------------------------
  // ACTION ITEM STATUS
  // ---------------------------------------------------------

  const handleActionStatusChange = (
    actionItem,
    status
  ) => {
    updateActionItem(actionItem.id, {
      status,
    });
  };

  // ---------------------------------------------------------
  // ACTION ITEM PRIORITY
  // ---------------------------------------------------------

  const handleActionPriorityChange = (
    actionItem,
    priority
  ) => {
    updateActionItem(actionItem.id, {
      priority,
    });
  };

  // ---------------------------------------------------------
  // OVERDUE CHECK
  // ---------------------------------------------------------

  const isOverdue = (actionItem) => {
    if (!actionItem.deadline) return false;

    if (actionItem.status === "completed") {
      return false;
    }

    const deadline = new Date(
      actionItem.deadline
    );

    if (Number.isNaN(deadline.getTime())) {
      return false;
    }

    return deadline < new Date();
  };

  // ---------------------------------------------------------
  // FILTERED ACTION ITEMS
  // ---------------------------------------------------------

  const filteredActionItems = useMemo(() => {
    return actionItems.filter((item) => {
      if (actionFilter === "all") return true;

      if (actionFilter === "overdue") {
        return isOverdue(item);
      }

      return item.status === actionFilter;
    });
  }, [actionItems, actionFilter]);

  // ---------------------------------------------------------
  // ACTION ITEM STATS
  // ---------------------------------------------------------

  const actionStats = useMemo(() => {
    const total = actionItems.length;

    const pending = actionItems.filter(
      (item) => item.status === "pending"
    ).length;

    const inProgress = actionItems.filter(
      (item) => item.status === "in_progress"
    ).length;

    const completed = actionItems.filter(
      (item) => item.status === "completed"
    ).length;

    const overdue = actionItems.filter(
      (item) => isOverdue(item)
    ).length;

    return {
      total,
      pending,
      inProgress,
      completed,
      overdue,
    };
  }, [actionItems]);

  // ---------------------------------------------------------
  // PDF REPORT
  // ---------------------------------------------------------

  const downloadReport = async () => {
    try {
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

      const url = window.URL.createObjectURL(
        blob
      );

      const link = document.createElement("a");

      link.href = url;
      link.download = `meeting_report_${meetingId}.pdf`;

      document.body.appendChild(link);
      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(
        "Failed to download report:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Failed to generate meeting report."
      );
    }
  };

  // ---------------------------------------------------------
  // MEETING SCORE
  // ---------------------------------------------------------

  const meetingScore =
    meeting?.effectiveness_score ?? null;

  const meetingRating =
    meeting?.effectiveness_rating || "";

  const scoreBreakdown = meeting?.score_breakdown || {};

  // ---------------------------------------------------------
  // AI DATA
  // ---------------------------------------------------------

  const keyPoints = safeJsonParse(
    meeting?.key_points,
    []
  );

  const decisions = safeJsonParse(
    meeting?.decisions,
    []
  );

  const insights = safeJsonParse(
    meeting?.meeting_insights,
    []
  );

  const recommendations = safeJsonParse(
    meeting?.meeting_recommendations,
    []
  );

  // ---------------------------------------------------------
  // LOADING STATE
  // ---------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />

          <p className="text-gray-600">
            Loading meeting...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // ERROR / NOT FOUND
  // ---------------------------------------------------------

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>

          <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />

            <h2 className="text-xl font-semibold text-gray-900">
              Meeting not found
            </h2>

            <p className="text-gray-500 mt-2">
              {error ||
                "The requested meeting could not be loaded."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  navigate("/dashboard")
                }
                className="p-2 rounded-lg hover:bg-gray-100 transition"
              >
                <ArrowLeft size={20} />
              </button>

              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {meeting.title ||
                      "Untitled Meeting"}
                  </h1>

                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusClass(
                      meeting.status
                    )}`}
                  >
                    {getStatusLabel(
                      meeting.status
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <FileText size={15} />

                    {meeting.file_name}
                  </span>

                  <span className="flex items-center gap-1">
                    <CalendarDays size={15} />

                    {formatDate(
                      meeting.created_at
                    )}
                  </span>

                  {meeting.duration && (
                    <span className="flex items-center gap-1">
                      <Clock3 size={15} />

                      {formatDuration(
                        meeting.duration
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={17}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh
              </button>

              {meeting.status ===
                "completed" && (
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  <Download size={17} />

                  PDF Report
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* ERROR */}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1">
              <p className="font-medium">
                Something went wrong
              </p>

              <p className="text-sm mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* ===================================================
            PROCESSING BAR
        ==================================================== */}

        {(processing ||
          [
            "transcribing",
            "diarizing",
            "analyzing",
            "processing",
          ].includes(meeting.status)) && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />

              <div>
                <p className="font-semibold text-blue-900">
                  {processingStep ||
                    getStatusLabel(
                      meeting.status
                    )}
                </p>

                <p className="text-sm text-blue-700 mt-1">
                  Your meeting is being processed.
                  This may take a few minutes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            PIPELINE ACTIONS
        ==================================================== */}

        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">
                Processing Pipeline
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Process your meeting step by step using
                local AI services.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {meeting.status ===
                "audio_ready" && (
                <button
                  onClick={handleTranscribe}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <FileAudio size={17} />

                  Transcribe
                </button>
              )}

              {meeting.status ===
                "transcribed" && (
                <>
                  <button
                    onClick={handleDiarize}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    <Users size={17} />

                    Identify Speakers
                  </button>

                  <button
                    onClick={handleAnalyze}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Brain size={17} />

                    Analyze with AI
                  </button>
                </>
              )}

              {meeting.status ===
                "completed" && (
                <button
                  onClick={handleAnalyze}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw size={17} />

                  Re-analyze
                </button>
              )}
            </div>
          </div>

          {/* PIPELINE STEPS */}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
            {[
              {
                label: "Audio",
                completed: [
                  "audio_ready",
                  "transcribing",
                  "transcribed",
                  "diarizing",
                  "analyzing",
                  "completed",
                ].includes(
                  meeting.status
                ),
              },
              {
                label: "Transcription",
                completed: [
                  "transcribed",
                  "diarizing",
                  "analyzing",
                  "completed",
                ].includes(
                  meeting.status
                ),
              },
              {
                label: "Speakers",
                completed: [
                  "diarizing",
                  "analyzing",
                  "completed",
                ].includes(
                  meeting.status
                ),
              },
              {
                label: "AI Analysis",
                completed:
                  meeting.status ===
                  "completed",
              },
            ].map((step) => (
              <div
                key={step.label}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  step.completed
                    ? "bg-green-50 border-green-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                {step.completed ? (
                  <CheckCircle2
                    size={19}
                    className="text-green-600"
                  />
                ) : (
                  <Circle
                    size={19}
                    className="text-gray-400"
                  />
                )}

                <span
                  className={`text-sm font-medium ${
                    step.completed
                      ? "text-green-800"
                      : "text-gray-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ===================================================
            MEETING SCORE
        ==================================================== */}

        {meetingScore !== null && (
          <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Meeting Effectiveness
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  AI-generated assessment based on meeting
                  activity and outcomes.
                </p>
              </div>

              <Target
                className="text-blue-600"
                size={25}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="border border-gray-200 rounded-xl p-5 flex items-center gap-5">
                <div className="w-24 h-24 rounded-full border-8 border-blue-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-700">
                    {meetingScore}
                  </span>
                </div>

                <div>
                  <p className="text-sm text-gray-500">
                    Overall Score
                  </p>

                  <p className="text-xl font-semibold text-gray-900">
                    {meetingRating}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  [
                    "Participation",
                    scoreBreakdown.participation,
                  ],
                  [
                    "Sentiment",
                    scoreBreakdown.sentiment,
                  ],
                  [
                    "Action Items",
                    scoreBreakdown.action_items,
                  ],
                  [
                    "Transcript",
                    scoreBreakdown.transcript_quality,
                  ],
                  [
                    "Efficiency",
                    scoreBreakdown.efficiency,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="bg-gray-50 rounded-lg p-4"
                  >
                    <p className="text-xs text-gray-500">
                      {label}
                    </p>

                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {value ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===================================================
            AUDIO PLAYER
        ==================================================== */}

        {audioUrl && (
          <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Meeting Recording
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Listen to the recording and jump directly
                  to transcript timestamps.
                </p>
              </div>

              <Volume2
                size={22}
                className="text-blue-600"
              />
            </div>

            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={
                handleAudioTimeUpdate
              }
              onLoadedMetadata={
                handleAudioLoaded
              }
              onPlay={handleAudioPlay}
              onPause={handleAudioPause}
              onEnded={handleAudioEnded}
              className="hidden"
            />

            <div className="flex items-center gap-4">
              <button
                onClick={toggleAudio}
                className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition"
              >
                {audioPlaying ? (
                  <Pause size={21} />
                ) : (
                  <Play
                    size={21}
                    className="ml-0.5"
                  />
                )}
              </button>

              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max={audioDuration || 0}
                  step="0.1"
                  value={audioCurrentTime}
                  onChange={(event) => {
                    const time = Number(
                      event.target.value
                    );

                    if (audioRef.current) {
                      audioRef.current.currentTime =
                        time;
                    }

                    setAudioCurrentTime(time);
                  }}
                  className="w-full"
                />

                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>
                    {formatTimestamp(
                      audioCurrentTime
                    )}
                  </span>

                  <span>
                    {formatTimestamp(
                      audioDuration
                    )}
                  </span>
                </div>
              </div>
            </div>

            {audioLoading && (
              <p className="text-sm text-gray-500 mt-3">
                Loading audio...
              </p>
            )}
          </section>
        )}

        {/* ===================================================
            AI SUMMARY
        ==================================================== */}

        {meeting.summary && (
          <section className="bg-white border border-gray-200 rounded-xl mb-6">
            <button
              onClick={() =>
                toggleSection("summary")
              }
              className="w-full px-6 py-5 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Brain
                  size={21}
                  className="text-blue-600"
                />

                <div>
                  <h2 className="font-semibold text-gray-900">
                    AI Executive Summary
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Generated from the meeting transcript.
                  </p>
                </div>
              </div>

              {expandedSections.summary ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>

            {expandedSections.summary && (
              <div className="px-6 pb-6">
                <p className="text-gray-700 leading-7">
                  {meeting.summary}
                </p>
              </div>
            )}
          </section>
        )}

        {/* ===================================================
            KEY POINTS + DECISIONS
        ==================================================== */}

        {(keyPoints.length > 0 ||
          decisions.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* KEY POINTS */}

            {keyPoints.length > 0 && (
              <section className="bg-white border border-gray-200 rounded-xl">
                <button
                  onClick={() =>
                    toggleSection("keyPoints")
                  }
                  className="w-full px-6 py-5 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare
                      size={21}
                      className="text-blue-600"
                    />

                    <h2 className="font-semibold text-gray-900">
                      Key Points
                    </h2>
                  </div>

                  {expandedSections.keyPoints ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}
                </button>

                {expandedSections.keyPoints && (
                  <div className="px-6 pb-6">
                    <ul className="space-y-3">
                      {keyPoints.map(
                        (point, index) => (
                          <li
                            key={index}
                            className="flex gap-3"
                          >
                            <span className="w-6 h-6 shrink-0 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                              {index + 1}
                            </span>

                            <span className="text-gray-700 leading-6">
                              {point}
                            </span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* DECISIONS */}

            {decisions.length > 0 && (
              <section className="bg-white border border-gray-200 rounded-xl">
                <button
                  onClick={() =>
                    toggleSection("decisions")
                  }
                  className="w-full px-6 py-5 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2
                      size={21}
                      className="text-green-600"
                    />

                    <h2 className="font-semibold text-gray-900">
                      Decisions
                    </h2>
                  </div>

                  {expandedSections.decisions ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}
                </button>

                {expandedSections.decisions && (
                  <div className="px-6 pb-6">
                    <ul className="space-y-3">
                      {decisions.map(
                        (decision, index) => (
                          <li
                            key={index}
                            className="flex gap-3"
                          >
                            <Check
                              size={18}
                              className="text-green-600 mt-1 shrink-0"
                            />

                            <span className="text-gray-700 leading-6">
                              {decision}
                            </span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* ===================================================
            ACTION ITEMS
        ==================================================== */}

        <section className="bg-white border border-gray-200 rounded-xl mb-6">
          <button
            onClick={() =>
              toggleSection("actions")
            }
            className="w-full px-6 py-5 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2
                size={21}
                className="text-purple-600"
              />

              <div>
                <h2 className="font-semibold text-gray-900">
                  Action Items
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Tasks extracted from the meeting.
                </p>
              </div>
            </div>

            {expandedSections.actions ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </button>

          {expandedSections.actions && (
            <div className="px-6 pb-6">
              {/* STATS */}

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                {[
                  [
                    "Total",
                    actionStats.total,
                  ],
                  [
                    "Pending",
                    actionStats.pending,
                  ],
                  [
                    "In Progress",
                    actionStats.inProgress,
                  ],
                  [
                    "Completed",
                    actionStats.completed,
                  ],
                  [
                    "Overdue",
                    actionStats.overdue,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="bg-gray-50 rounded-lg p-3"
                  >
                    <p className="text-xs text-gray-500">
                      {label}
                    </p>

                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* FILTER */}

              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  ["all", "All"],
                  ["pending", "Pending"],
                  ["in_progress", "In Progress"],
                  ["completed", "Completed"],
                  ["overdue", "Overdue"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() =>
                      setActionFilter(value)
                    }
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      actionFilter === value
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* ACTION ITEMS */}

              {filteredActionItems.length ===
              0 ? (
                <div className="text-center py-10 text-gray-500">
                  <CheckCircle2
                    size={30}
                    className="mx-auto mb-2 opacity-50"
                  />

                  No action items found.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredActionItems.map(
                    (item) => (
                      <div
                        key={item.id}
                        className={`border rounded-xl p-4 ${
                          isOverdue(item)
                            ? "border-red-200 bg-red-50"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-start gap-3">
                              {item.status ===
                              "completed" ? (
                                <CheckCircle2
                                  size={20}
                                  className="text-green-600 mt-0.5 shrink-0"
                                />
                              ) : (
                                <Circle
                                  size={20}
                                  className="text-gray-400 mt-0.5 shrink-0"
                                />
                              )}

                              <div>
                                <p
                                  className={`font-medium ${
                                    item.status ===
                                    "completed"
                                      ? "line-through text-gray-400"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {item.task}
                                </p>

                                <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                                  <span>
                                    Assigned:{" "}
                                    {item.assigned_to ||
                                      "Unknown"}
                                  </span>

                                  <span>
                                    Deadline:{" "}
                                    {item.deadline ||
                                      "Not mentioned"}
                                  </span>

                                  {isOverdue(
                                    item
                                  ) && (
                                    <span className="text-red-600 font-medium flex items-center gap-1">
                                      <AlertCircle
                                        size={14}
                                      />

                                      Overdue
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={
                                item.status ||
                                "pending"
                              }
                              onChange={(event) =>
                                handleActionStatusChange(
                                  item,
                                  event.target.value
                                )
                              }
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
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

                            <select
                              value={
                                item.priority ||
                                "medium"
                              }
                              onChange={(event) =>
                                handleActionPriorityChange(
                                  item,
                                  event.target.value
                                )
                              }
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
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
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ===================================================
            ANALYTICS
        ==================================================== */}

        {meeting.status ===
          "completed" && (
          <section className="bg-white border border-gray-200 rounded-xl mb-6">
            <button
              onClick={() =>
                toggleSection("analytics")
              }
              className="w-full px-6 py-5 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <BarChart3
                  size={21}
                  className="text-blue-600"
                />

                <div>
                  <h2 className="font-semibold text-gray-900">
                    Meeting Intelligence
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Communication and meeting metrics.
                  </p>
                </div>
              </div>

              {expandedSections.analytics ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>

            {expandedSections.analytics && (
              <div className="px-6 pb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-xl p-5">
                    <p className="text-sm text-gray-500">
                      Total Words
                    </p>

                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {meeting.total_words ??
                        0}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-5">
                    <p className="text-sm text-gray-500">
                      Speakers
                    </p>

                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {meeting.speaker_count ??
                        speakers.length ??
                        0}
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-xl p-5">
                    <p className="text-sm text-green-700">
                      Positive
                    </p>

                    <p className="text-2xl font-bold text-green-800 mt-1">
                      {meeting.positive_sentiment ??
                        0}
                    </p>
                  </div>

                  <div className="bg-red-50 rounded-xl p-5">
                    <p className="text-sm text-red-700">
                      Negative
                    </p>

                    <p className="text-2xl font-bold text-red-800 mt-1">
                      {meeting.negative_sentiment ??
                        0}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="border border-green-200 bg-green-50 rounded-xl p-5">
                    <div className="flex items-center gap-2">
                      <TrendingUp
                        size={18}
                        className="text-green-600"
                      />

                      <span className="font-medium text-green-800">
                        Positive Sentiment
                      </span>
                    </div>

                    <p className="text-3xl font-bold text-green-800 mt-3">
                      {meeting.positive_sentiment ??
                        0}
                    </p>
                  </div>

                  <div className="border border-red-200 bg-red-50 rounded-xl p-5">
                    <div className="flex items-center gap-2">
                      <TrendingDown
                        size={18}
                        className="text-red-600"
                      />

                      <span className="font-medium text-red-800">
                        Negative Sentiment
                      </span>
                    </div>

                    <p className="text-3xl font-bold text-red-800 mt-3">
                      {meeting.negative_sentiment ??
                        0}
                    </p>
                  </div>

                  <div className="border border-gray-200 bg-gray-50 rounded-xl p-5">
                    <div className="flex items-center gap-2">
                      <Minus
                        size={18}
                        className="text-gray-600"
                      />

                      <span className="font-medium text-gray-800">
                        Neutral Sentiment
                      </span>
                    </div>

                    <p className="text-3xl font-bold text-gray-800 mt-3">
                      {meeting.neutral_sentiment ??
                        0}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ===================================================
            SPEAKER INTELLIGENCE
        ==================================================== */}

        {meeting.speaker_analytics &&
          meeting.speaker_analytics.length >
            0 && (
            <section className="bg-white border border-gray-200 rounded-xl mb-6">
              <button
                onClick={() =>
                  toggleSection("speakers")
                }
                className="w-full px-6 py-5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <Users
                    size={21}
                    className="text-purple-600"
                  />

                  <div>
                    <h2 className="font-semibold text-gray-900">
                      Speaker Intelligence
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                      Participation and speaking distribution.
                    </p>
                  </div>
                </div>

                {expandedSections.speakers ? (
                  <ChevronUp size={20} />
                ) : (
                  <ChevronDown size={20} />
                )}
              </button>

              {expandedSections.speakers && (
                <div className="px-6 pb-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="py-3 text-sm font-medium text-gray-500">
                            Speaker
                          </th>

                          <th className="py-3 text-sm font-medium text-gray-500">
                            Speaking Time
                          </th>

                          <th className="py-3 text-sm font-medium text-gray-500">
                            Words
                          </th>

                          <th className="py-3 text-sm font-medium text-gray-500">
                            Share
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {meeting.speaker_analytics.map(
                          (speaker, index) => {
                            const totalWords =
                              meeting.total_words ||
                              1;

                            const percentage =
                              speaker.word_count
                                ? (
                                    (speaker.word_count /
                                      totalWords) *
                                    100
                                  ).toFixed(1)
                                : "0.0";

                            return (
                              <tr
                                key={
                                  speaker.id ||
                                  index
                                }
                                className="border-b border-gray-100"
                              >
                                <td className="py-4 font-medium text-gray-900">
                                  {speaker.speaker}
                                </td>

                                <td className="py-4 text-gray-600">
                                  {formatDuration(
                                    speaker.speaking_time
                                  )}
                                </td>

                                <td className="py-4 text-gray-600">
                                  {speaker.word_count ??
                                    0}
                                </td>

                                <td className="py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-600 rounded-full"
                                        style={{
                                          width: `${Math.min(
                                            Number(
                                              percentage
                                            ),
                                            100
                                          )}%`,
                                        }}
                                      />
                                    </div>

                                    <span className="text-sm text-gray-600">
                                      {percentage}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

        {/* ===================================================
            AI INSIGHTS
        ==================================================== */}

        {insights.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-xl mb-6">
            <button
              onClick={() =>
                toggleSection("insights")
              }
              className="w-full px-6 py-5 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Lightbulb
                  size={21}
                  className="text-yellow-500"
                />

                <div>
                  <h2 className="font-semibold text-gray-900">
                    AI Insights
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Key observations generated from meeting data.
                  </p>
                </div>
              </div>

              {expandedSections.insights ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>

            {expandedSections.insights && (
              <div className="px-6 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.map(
                    (insight, index) => {
                      const type =
                        insight.type ||
                        "neutral";

                      const isPositive =
                        type === "positive";

                      const isNegative =
                        type === "negative";

                      return (
                        <div
                          key={index}
                          className={`rounded-xl border p-5 ${
                            isPositive
                              ? "bg-green-50 border-green-200"
                              : isNegative
                              ? "bg-red-50 border-red-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Lightbulb
                              size={19}
                              className={
                                isPositive
                                  ? "text-green-600"
                                  : isNegative
                                  ? "text-red-600"
                                  : "text-gray-600"
                              }
                            />

                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {insight.title ||
                                  "Insight"}
                              </h3>

                              <p className="text-sm text-gray-600 mt-2 leading-6">
                                {
                                  insight.description
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ===================================================
            AI RECOMMENDATIONS
        ==================================================== */}

        {recommendations.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-xl mb-6">
            <button
              onClick={() =>
                toggleSection(
                  "recommendations"
                )
              }
              className="w-full px-6 py-5 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Target
                  size={21}
                  className="text-blue-600"
                />

                <div>
                  <h2 className="font-semibold text-gray-900">
                    AI Recommendations
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Suggestions for improving future meetings.
                  </p>
                </div>
              </div>

              {expandedSections.recommendations ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>

            {expandedSections.recommendations && (
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  {recommendations.map(
                    (recommendation, index) => (
                      <div
                        key={index}
                        className="flex gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                          {index + 1}
                        </div>

                        <p className="text-gray-700 leading-6">
                          {recommendation}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ===================================================
            TRANSCRIPT
        ==================================================== */}

        {transcript && (
          <section className="bg-white border border-gray-200 rounded-xl mb-6">
            <button
              onClick={() =>
                toggleSection("transcript")
              }
              className="w-full px-6 py-5 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <FileText
                  size={21}
                  className="text-blue-600"
                />

                <div>
                  <h2 className="font-semibold text-gray-900">
                    Transcript
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Search, filter and navigate the synchronized transcript.
                  </p>
                </div>
              </div>

              {expandedSections.transcript ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>

            {expandedSections.transcript && (
              <div className="px-6 pb-6">
                {/* SEARCH + FILTER */}

                <div className="flex flex-col md:flex-row gap-3 mb-5">
                  <div className="relative flex-1">
                    <Search
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="text"
                      value={transcriptSearch}
                      onChange={(event) =>
                        setTranscriptSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search transcript..."
                      className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="relative">
                    <Filter
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <select
                      value={speakerFilter}
                      onChange={(event) =>
                        setSpeakerFilter(
                          event.target.value
                        )
                      }
                      className="border border-gray-200 rounded-lg pl-9 pr-8 py-2.5 bg-white outline-none"
                    >
                      <option value="all">
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
                </div>

                {/* TRANSCRIPT */}

                {transcriptSegments.length ===
                0 ? (
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-gray-700 whitespace-pre-wrap leading-7">
                      {transcript.content ||
                        "No transcript available."}
                    </p>
                  </div>
                ) : filteredTranscript.length ===
                  0 ? (
                  <div className="text-center py-10 text-gray-500">
                    No transcript segments match your search.
                  </div>
                ) : (
                  <div className="max-h-[650px] overflow-y-auto border border-gray-200 rounded-xl">
                    <div className="divide-y divide-gray-100">
                      {filteredTranscript.map(
                        (segment) => {
                          const originalIndex =
                            segment.originalIndex;

                          const isActive =
                            originalIndex ===
                            activeSegmentIndex;

                          return (
                            <div
                              key={`${originalIndex}-${segment.start}`}
                              ref={(element) => {
                                transcriptRefs.current[
                                  originalIndex
                                ] = element;
                              }}
                              className={`p-4 transition ${
                                isActive
                                  ? "bg-blue-50 border-l-4 border-blue-600"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                <button
                                  onClick={() =>
                                    jumpToTimestamp(
                                      Number(
                                        segment.start ||
                                          0
                                      )
                                    )
                                  }
                                  className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium ${
                                    isActive
                                      ? "bg-blue-600 text-white"
                                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  }`}
                                >
                                  {formatTimestamp(
                                    Number(
                                      segment.start ||
                                        0
                                    )
                                  )}
                                </button>

                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    {segment.speaker && (
                                      <span
                                        className={`text-sm font-semibold ${
                                          isActive
                                            ? "text-blue-700"
                                            : "text-gray-800"
                                        }`}
                                      >
                                        {
                                          segment.speaker
                                        }
                                      </span>
                                    )}

                                    <span className="text-xs text-gray-400">
                                      {formatTimestamp(
                                        Number(
                                          segment.start ||
                                            0
                                        )
                                      )}{" "}
                                      –{" "}
                                      {formatTimestamp(
                                        Number(
                                          segment.end ||
                                            0
                                        )
                                      )}
                                    </span>
                                  </div>

                                  <p
                                    className={`leading-6 ${
                                      isActive
                                        ? "text-blue-900"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    {segment.text}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===================================================
            FOOTER
        ==================================================== */}

        <div className="text-center text-sm text-gray-400 py-8">
          Smart AI Meeting Assistant
        </div>
      </main>
    </div>
  );
}
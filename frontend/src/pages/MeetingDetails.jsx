import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  Download,
  FileText,
  Headphones,
  LoaderCircle,
  Play,
  Pause,
  RefreshCw,
  Search,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Brain,
  BarChart3,
  ListChecks,
  MessageSquare,
  Sparkles,
  Send,
  Volume2,
  ChevronRight,
  X
} from "lucide-react";

import api from "../services/api";
import MeetingProcessingBar from "../components/MeetingProcessingBar";
import { useAuth } from "../context/AuthContext";


export default function MeetingDetails() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  // =========================================================
  // STATE
  // =========================================================

  const [meeting, setMeeting] = useState(null);

  const [transcript, setTranscript] = useState(null);

  const [actionItems, setActionItems] = useState([]);

  const [speakerAnalytics, setSpeakerAnalytics] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [activeTab, setActiveTab] =
    useState("overview");

  // Processing
  const [liveProgress, setLiveProgress] =
    useState(null);

  // Audio
  const audioRef = useRef(null);

  const [audioUrl, setAudioUrl] =
    useState("");

  const [audioCurrentTime, setAudioCurrentTime] =
    useState(0);

  const [audioDuration, setAudioDuration] =
    useState(0);

  const [audioLoading, setAudioLoading] =
    useState(false);

  const [isPlaying, setIsPlaying] =
    useState(false);

  // Transcript
  const [transcriptSearch, setTranscriptSearch] =
    useState("");

  const [speakerFilter, setSpeakerFilter] =
    useState("all");

  const transcriptRefs =
    useRef([]);

  const lastActiveSegment =
    useRef(-1);

  // Action items
  const [actionFilter, setActionFilter] =
    useState("all");

  const [actionUpdating, setActionUpdating] =
    useState(null);

  // Copilot
  const [copilotQuestion, setCopilotQuestion] =
    useState("");

  const [copilotAnswer, setCopilotAnswer] =
    useState("");

  const [copilotSources, setCopilotSources] =
    useState([]);

  const [copilotLoading, setCopilotLoading] =
    useState(false);

  const [copilotError, setCopilotError] =
    useState("");

  // Report
  const [reportLoading, setReportLoading] =
    useState(false);

  // =========================================================
  // TABS
  // =========================================================

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      icon: BarChart3
    },
    {
      id: "transcript",
      label: "Transcript",
      icon: FileText
    },
    {
      id: "speakers",
      label: "Speakers",
      icon: Users
    },
    {
      id: "actions",
      label: "Action Items",
      icon: ListChecks
    },
    {
      id: "ai",
      label: "AI Insights",
      icon: Brain
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3
    }
  ];

  // =========================================================
  // FETCH MEETING
  // =========================================================

  const loadMeeting = async () => {
    try {
      const response = await api.get(
        `/meetings/${meetingId}`
      );

      setMeeting(response.data);

    } catch (err) {
      console.error(
        "Meeting fetch error:",
        err
      );

      if (err.response?.status === 401) {
        logout();
        return;
      }

      setError(
        err.response?.data?.detail ||
        "Unable to load meeting."
      );
    }
  };

  // =========================================================
  // FETCH TRANSCRIPT
  // =========================================================

  const loadTranscript = async () => {
    try {
      const response = await api.get(
        `/meetings/${meetingId}/transcript`
      );

      setTranscript(response.data);

    } catch (err) {
      console.error(
        "Transcript fetch error:",
        err
      );

      // Transcript may not exist yet.
      setTranscript(null);
    }
  };

  // =========================================================
  // FETCH ACTION ITEMS
  // =========================================================

  const loadActionItems = async () => {
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
        "Action items fetch error:",
        err
      );

      setActionItems([]);
    }
  };

  // =========================================================
  // FETCH SPEAKER ANALYTICS
  // =========================================================

  const loadSpeakerAnalytics = async () => {
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
        "Speaker analytics error:",
        err
      );

      setSpeakerAnalytics([]);
    }
  };

  // =========================================================
  // LOAD EVERYTHING
  // =========================================================

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadMeeting(),
        loadTranscript(),
        loadActionItems(),
        loadSpeakerAnalytics()
      ]);

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    loadAll();
  }, [meetingId]);

  // =========================================================
  // WEBSOCKET PROCESSING
  // =========================================================

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    const socket = new WebSocket(
      `ws://127.0.0.1:8000/ws/meetings/${meetingId}`
    );

    socket.onopen = () => {
      console.log(
        "Connected to meeting processing updates"
      );
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(
          event.data
        );

        console.log(
          "Processing update:",
          data
        );

        setLiveProgress(data);

        setMeeting((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,

            status:
              data.status ||
              previous.status,

            processing_stage:
              data.stage ||
              previous.processing_stage,

            processing_message:
              data.message ||
              previous.processing_message,

            processing_progress:
              data.progress ??
              previous.processing_progress
          };
        });

        if (
          data.status === "completed"
        ) {
          loadAll();
        }

      } catch (err) {
        console.error(
          "WebSocket message error:",
          err
        );
      }
    };

    socket.onerror = (event) => {
      console.error(
        "WebSocket error:",
        event
      );
    };

    socket.onclose = () => {
      console.log(
        "Meeting WebSocket disconnected"
      );
    };

    return () => {
      socket.close();
    };
  }, [meetingId]);

  // =========================================================
  // PROCESSING FALLBACK POLLING
  // =========================================================

  useEffect(() => {
    const activeStatuses = [
      "processing",
      "transcribing",
      "diarizing",
      "analyzing"
    ];

    if (!meetingId || !activeStatuses.includes(meeting?.status)) {
      return;
    }

    const interval = setInterval(() => {
      loadMeeting();
    }, 2000);

    return () => clearInterval(interval);
  }, [meetingId, meeting?.status]);

  // =========================================================
  // AUDIO
  // =========================================================

  const loadAudio = async () => {
    try {
      setAudioLoading(true);

      const response = await api.get(
        `/meetings/${meetingId}/audio`,
        {
          responseType: "blob"
        }
      );

      const url = URL.createObjectURL(
        response.data
      );

      setAudioUrl((oldUrl) => {
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
        }

        return url;
      });

    } catch (err) {
      console.error(
        "Audio loading error:",
        err
      );
    } finally {
      setAudioLoading(false);
    }
  };

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    loadAudio();

    return () => {
      setAudioUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(
            currentUrl
          );
        }

        return "";
      });
    };
  }, [meetingId]);

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) {
      return;
    }

    setAudioCurrentTime(
      audioRef.current.currentTime
    );
  };

  const handleAudioLoaded = () => {
    if (!audioRef.current) {
      return;
    }

    setAudioDuration(
      audioRef.current.duration || 0
    );
  };

  const toggleAudio = async () => {
    if (!audioRef.current) {
      return;
    }

    if (
      audioRef.current.paused
    ) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error(
          "Audio play error:",
          err
        );
      }
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const jumpToTimestamp = (
    seconds
  ) => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime =
      Number(seconds) || 0;

    setAudioCurrentTime(
      Number(seconds) || 0
    );

    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {});
  };

  const formatTimestamp = (
    seconds
  ) => {
    const value =
      Number(seconds) || 0;

    const minutes =
      Math.floor(value / 60);

    const remainingSeconds =
      Math.floor(value % 60);

    return `${String(minutes).padStart(
      2,
      "0"
    )}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  // =========================================================
  // ACTIVE TRANSCRIPT SEGMENT
  // =========================================================

  const transcriptSegments =
    Array.isArray(
      transcript?.segments
    )
      ? transcript.segments
      : [];

  const activeSegmentIndex =
    transcriptSegments.findIndex(
      (segment) =>
        audioCurrentTime >=
          Number(segment.start || 0) &&
        audioCurrentTime <
          Number(segment.end || 0)
    );

  // Auto-scroll only when active segment changes.
  useEffect(() => {
    if (
      activeSegmentIndex < 0 ||
      activeSegmentIndex ===
        lastActiveSegment.current
    ) {
      return;
    }

    lastActiveSegment.current =
      activeSegmentIndex;

    const element =
      transcriptRefs.current[
        activeSegmentIndex
      ];

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [activeSegmentIndex]);

  // =========================================================
  // TRANSCRIPT FILTERING
  // =========================================================

  const speakers = useMemo(() => {
    const unique =
      new Set();

    transcriptSegments.forEach(
      (segment) => {
        if (segment.speaker) {
          unique.add(
            segment.speaker
          );
        }
      }
    );

    return Array.from(unique);
  }, [transcriptSegments]);

  const filteredTranscript =
    useMemo(() => {
      const search =
        transcriptSearch
          .trim()
          .toLowerCase();

      return transcriptSegments
        .map(
          (segment, index) => ({
            ...segment,
            originalIndex: index
          })
        )
        .filter((segment) => {
          const matchesSearch =
            !search ||
            segment.text
              ?.toLowerCase()
              .includes(search);

          const matchesSpeaker =
            speakerFilter === "all" ||
            segment.speaker ===
              speakerFilter;

          return (
            matchesSearch &&
            matchesSpeaker
          );
        });
    }, [
      transcriptSegments,
      transcriptSearch,
      speakerFilter
    ]);

  // =========================================================
  // ACTION ITEMS
  // =========================================================

  const isOverdue = (
    item
  ) => {
    if (!item.deadline) {
      return false;
    }

    if (
      item.status ===
      "completed"
    ) {
      return false;
    }

    const date =
      new Date(item.deadline);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return false;
    }

    return date < new Date();
  };

  const filteredActionItems =
    useMemo(() => {
      return actionItems.filter(
        (item) => {
          if (
            actionFilter === "all"
          ) {
            return true;
          }

          if (
            actionFilter === "overdue"
          ) {
            return isOverdue(item);
          }

          return (
            item.status ===
            actionFilter
          );
        }
      );
    }, [
      actionItems,
      actionFilter
    ]);

  const actionStats =
    useMemo(() => {
      return {
        total: actionItems.length,

        pending:
          actionItems.filter(
            (item) =>
              item.status ===
              "pending"
          ).length,

        inProgress:
          actionItems.filter(
            (item) =>
              item.status ===
              "in_progress"
          ).length,

        completed:
          actionItems.filter(
            (item) =>
              item.status ===
              "completed"
          ).length,

        overdue:
          actionItems.filter(
            (item) =>
              isOverdue(item)
          ).length
      };
    }, [actionItems]);

  const updateActionItem = async (
    itemId,
    updates
  ) => {
    try {
      setActionUpdating(itemId);

      const response =
        await api.patch(
          `/meetings/${meetingId}/action-items/${itemId}`,
          updates
        );

      setActionItems(
        (previous) =>
          previous.map((item) =>
            item.id === itemId
              ? response.data
              : item
          )
      );

    } catch (err) {
      console.error(
        "Action item update error:",
        err
      );

      setError(
        err.response?.data?.detail ||
        "Unable to update action item."
      );

    } finally {
      setActionUpdating(null);
    }
  };

  // =========================================================
  // COPILOT
  // =========================================================

  const askCopilot = async (
    event
  ) => {
    event?.preventDefault();

    const question =
      copilotQuestion.trim();

    if (!question) {
      return;
    }

    try {
      setCopilotLoading(true);
      setCopilotError("");
      setCopilotAnswer("");
      setCopilotSources([]);

      const response =
        await api.post(
          `/meetings/${meetingId}/ask`,
          {
            question
          }
        );

      setCopilotAnswer(
        response.data.answer || ""
      );

      setCopilotSources(
        Array.isArray(
          response.data.sources
        )
          ? response.data.sources
          : []
      );

    } catch (err) {
      console.error(
        "Copilot error:",
        err
      );

      setCopilotError(
        err.response?.data?.detail ||
        "Unable to get an AI answer."
      );

    } finally {
      setCopilotLoading(false);
    }
  };

  const suggestedQuestions = [
    "What were the main decisions?",
    "What action items were assigned?",
    "What issues are still unresolved?",
    "Summarize the key discussion points."
  ];

  // =========================================================
  // PDF REPORT
  // =========================================================

  const downloadReport = async () => {
    try {
      setReportLoading(true);

      const response =
        await api.get(
          `/meetings/${meetingId}/report`,
          {
            responseType: "blob"
          }
        );

      const blob =
        new Blob(
          [response.data],
          {
            type:
              "application/pdf"
          }
        );

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      link.download =
        `meeting_report_${meetingId}.pdf`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        url
      );

    } catch (err) {
      console.error(
        "Report download error:",
        err
      );

      setError(
        err.response?.data?.detail ||
        "Unable to download report."
      );

    } finally {
      setReportLoading(false);
    }
  };

  // =========================================================
  // FORMATTING
  // =========================================================

  const formatDate = (
    value
  ) => {
    if (!value) {
      return "Date unavailable";
    }

    try {
      return new Date(
        value
      ).toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }
      );
    } catch {
      return "Date unavailable";
    }
  };

  const formatDuration = (
    seconds
  ) => {
    if (
      seconds === null ||
      seconds === undefined
    ) {
      return "—";
    }

    const value =
      Number(seconds);

    if (
      Number.isNaN(value)
    ) {
      return "—";
    }

    const minutes =
      Math.floor(value / 60);

    const remaining =
      Math.floor(value % 60);

    return `${minutes}m ${remaining}s`;
  };

  const getStatusStyle = (
    status
  ) => {
    const normalized =
      status
        ?.toLowerCase()
        ?.trim();

    if (
      normalized ===
      "completed"
    ) {
      return "bg-green-100 text-green-700";
    }

    if (
      [
        "processing",
        "preprocessing",
        "audio_ready",
        "transcribing",
        "diarizing",
        "analyzing"
      ].includes(normalized)
    ) {
      return "bg-yellow-100 text-yellow-700";
    }

    if (
      [
        "failed",
        "processing_failed",
        "transcription_failed",
        "analysis_failed",
        "diarization_failed"
      ].includes(normalized)
    ) {
      return "bg-red-100 text-red-700";
    }

    return "bg-slate-100 text-slate-600";
  };

  const getPriorityStyle = (
    priority
  ) => {
    if (
      priority === "high"
    ) {
      return "bg-red-100 text-red-700";
    }

    if (
      priority === "low"
    ) {
      return "bg-slate-100 text-slate-600";
    }

    return "bg-yellow-100 text-yellow-700";
  };

  const getInsightStyle = (
    type
  ) => {
    if (
      type === "positive"
    ) {
      return "border-green-200 bg-green-50";
    }

    if (
      type === "warning"
    ) {
      return "border-yellow-200 bg-yellow-50";
    }

    return "border-blue-200 bg-blue-50";
  };

  // =========================================================
  // SCORE
  // =========================================================

  const score =
    meeting?.effectiveness_score;

  const scoreBreakdown =
    meeting?.effectiveness_breakdown ||
    meeting?.score_breakdown ||
    {};

  // =========================================================
  // AI INSIGHTS
  // =========================================================

  let insights = [];

  let recommendations = [];

  try {
    if (
      Array.isArray(
        meeting?.meeting_insights
      )
    ) {
      insights =
        meeting.meeting_insights;
    } else if (
      typeof meeting?.meeting_insights ===
      "string"
    ) {
      insights = JSON.parse(
        meeting.meeting_insights
      );
    }
  } catch {
    insights = [];
  }

  try {
    if (
      Array.isArray(
        meeting?.meeting_recommendations
      )
    ) {
      recommendations =
        meeting.meeting_recommendations;
    } else if (
      typeof meeting?.meeting_recommendations ===
      "string"
    ) {
      recommendations =
        JSON.parse(
          meeting.meeting_recommendations
        );
    }
  } catch {
    recommendations = [];
  }

  // =========================================================
  // KEY POINTS / DECISIONS
  // =========================================================

  let keyPoints = [];

  let decisions = [];

  try {
    if (
      Array.isArray(
        meeting?.key_points
      )
    ) {
      keyPoints =
        meeting.key_points;
    } else if (
      typeof meeting?.key_points ===
      "string"
    ) {
      keyPoints =
        JSON.parse(
          meeting.key_points
        );
    }
  } catch {
    keyPoints = [];
  }

  try {
    if (
      Array.isArray(
        meeting?.decisions
      )
    ) {
      decisions =
        meeting.decisions;
    } else if (
      typeof meeting?.decisions ===
      "string"
    ) {
      decisions =
        JSON.parse(
          meeting.decisions
        );
    }
  } catch {
    decisions = [];
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">

        <div className="flex min-h-screen items-center justify-center">

          <div className="flex flex-col items-center">

            <LoaderCircle
              size={36}
              className="animate-spin text-slate-600"
            />

            <p className="mt-4 text-sm text-slate-500">
              Loading meeting...
            </p>

          </div>

        </div>

      </div>
    );
  }

  // =========================================================
  // NOT FOUND
  // =========================================================

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50">

        <div className="mx-auto max-w-3xl px-6 py-16 text-center">

          <AlertCircle
            size={40}
            className="mx-auto text-red-500"
          />

          <h2 className="mt-4 text-xl font-semibold text-slate-900">
            Meeting not found
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {error ||
              "The requested meeting could not be loaded."}
          </p>

          <button
            onClick={() =>
              navigate("/dashboard")
            }
            className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Back to Dashboard
          </button>

        </div>

      </div>
    );
  }

  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <div className="min-h-screen bg-slate-50">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="border-b bg-white">

        <div className="mx-auto max-w-7xl px-6 py-4">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div className="flex items-start gap-3">

              <button
                onClick={() =>
                  navigate("/dashboard")
                }
                className="mt-1 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                title="Back"
              >
                <ArrowLeft
                  size={18}
                />
              </button>

              <div>

                <h1 className="text-2xl font-bold text-slate-900">
                  {meeting.title ||
                    `Meeting #${meeting.id}`}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  {meeting.file_name ||
                    "Meeting recording"}
                </p>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">

                  <span className="flex items-center gap-1">
                    <Clock size={14} />

                    {formatDate(
                      meeting.created_at
                    )}
                  </span>

                  <span className="flex items-center gap-1">
                    <Headphones
                      size={14}
                    />

                    {formatDuration(
                      meeting.duration
                    )}
                  </span>

                  <span className="flex items-center gap-1">
                    <FileText
                      size={14}
                    />

                    {meeting.total_words ||
                      0}{" "}
                    words
                  </span>

                  <span className="flex items-center gap-1">
                    <Users
                      size={14}
                    />

                    {meeting.speaker_count ||
                      0}{" "}
                    speakers
                  </span>

                </div>

              </div>

            </div>

            <div className="flex items-center gap-2">

              <span
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${getStatusStyle(
                  meeting.status
                )}`}
              >
                {meeting.status ||
                  "Unknown"}
              </span>

              <button
                onClick={loadAll}
                className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-100"
                title="Refresh"
              >
                <RefreshCw
                  size={18}
                />
              </button>

              <button
                onClick={downloadReport}
                disabled={reportLoading}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {reportLoading ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Download
                    size={16}
                  />
                )}

                Report
              </button>

            </div>

          </div>

          {/* PROCESSING */}

          <div className="mt-4">

            <MeetingProcessingBar
              meeting={
                liveProgress
                  ? {
                      ...meeting,
                      status:
                        liveProgress.status,
                      processing_stage:
                        liveProgress.stage,
                      processing_message:
                        liveProgress.message,
                      processing_progress:
                        liveProgress.progress
                    }
                  : meeting
              }
            />

          </div>

        </div>

      </header>

      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="mx-auto max-w-7xl px-6 pt-4">

          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

            <div className="flex items-center gap-2">
              <AlertCircle
                size={17}
              />

              {error}
            </div>

            <button
              onClick={() =>
                setError("")
              }
            >
              <X size={17} />
            </button>

          </div>

        </div>
      )}

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="mx-auto max-w-7xl px-6 py-6">

        {/* ===================================================
            TABS
        ==================================================== */}

        <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">

          <div className="flex min-w-max">

            {tabs.map(
              (tab) => {
                const Icon =
                  tab.icon;

                const active =
                  activeTab ===
                  tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() =>
                      setActiveTab(
                        tab.id
                      )
                    }
                    className={`flex items-center gap-2 border-b-2 px-5 py-4 text-sm font-medium transition ${
                      active
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Icon
                      size={17}
                    />

                    {tab.label}
                  </button>
                );
              }
            )}

          </div>

        </div>

        {/* ===================================================
            OVERVIEW
        ==================================================== */}

        {activeTab ===
          "overview" && (
          <div className="space-y-6">

            {/* KPI */}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Words
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {meeting.total_words ||
                    0}
                </p>

              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Speakers
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {meeting.speaker_count ||
                    0}
                </p>

              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Action Items
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {
                    actionStats.total
                  }
                </p>

              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Effectiveness
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {score ??
                    "—"}
                  {score !==
                    null &&
                    score !==
                      undefined &&
                    "/100"}
                </p>

              </div>

            </div>

            {/* SUMMARY */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-center gap-2">

                <Sparkles
                  size={20}
                  className="text-slate-700"
                />

                <h2 className="text-lg font-semibold text-slate-900">
                  Executive Summary
                </h2>

              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {meeting.summary ||
                  "No summary available yet."}
              </p>

            </section>

            {/* KEY POINTS + DECISIONS */}

            <div className="grid gap-6 lg:grid-cols-2">

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

                <h2 className="text-lg font-semibold text-slate-900">
                  Key Points
                </h2>

                {keyPoints.length >
                0 ? (
                  <ul className="mt-4 space-y-3">

                    {keyPoints.map(
                      (
                        point,
                        index
                      ) => (
                        <li
                          key={index}
                          className="flex gap-3 text-sm leading-6 text-slate-600"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />

                          <span>
                            {point}
                          </span>
                        </li>
                      )
                    )}

                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No key points available.
                  </p>
                )}

              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

                <h2 className="text-lg font-semibold text-slate-900">
                  Decisions
                </h2>

                {decisions.length >
                0 ? (
                  <ul className="mt-4 space-y-3">

                    {decisions.map(
                      (
                        decision,
                        index
                      ) => (
                        <li
                          key={index}
                          className="flex gap-3 text-sm leading-6 text-slate-600"
                        >
                          <CheckCircle2
                            size={17}
                            className="mt-1 shrink-0 text-green-600"
                          />

                          <span>
                            {decision}
                          </span>
                        </li>
                      )
                    )}

                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No decisions available.
                  </p>
                )}

              </section>

            </div>

            {/* EFFECTIVENESS */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                <div>

                  <p className="text-sm font-medium text-slate-500">
                    Meeting Effectiveness
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    AI-generated meeting performance score
                  </p>

                </div>

                <div className="flex items-center gap-4">

                  <div className="text-4xl font-bold text-slate-900">
                    {score ??
                      "—"}
                  </div>

                  {meeting.effectiveness_rating && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                      {
                        meeting.effectiveness_rating
                      }
                    </span>
                  )}

                </div>

              </div>

              {Object.keys(
                scoreBreakdown
              ).length >
                0 && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

                  {Object.entries(
                    scoreBreakdown
                  ).map(
                    (
                      [
                        key,
                        value
                      ]
                    ) => (
                      <div
                        key={key}
                        className="rounded-lg bg-slate-50 p-4"
                      >

                        <p className="text-xs capitalize text-slate-500">
                          {key.replace(
                            /_/g,
                            " "
                          )}
                        </p>

                        <p className="mt-2 text-xl font-bold text-slate-900">
                          {value}
                        </p>

                      </div>
                    )
                  )}

                </div>
              )}

            </section>

          </div>
        )}

        {/* ===================================================
            TRANSCRIPT
        ==================================================== */}

        {activeTab ===
          "transcript" && (
          <div className="space-y-6">

            {/* AUDIO */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className="rounded-lg bg-slate-100 p-3">
                    <Volume2
                      size={20}
                      className="text-slate-700"
                    />
                  </div>

                  <div>

                    <h2 className="font-semibold text-slate-900">
                      Meeting Audio
                    </h2>

                    <p className="text-xs text-slate-500">
                      Click transcript timestamps to jump.
                    </p>

                  </div>

                </div>

                {audioLoading && (
                  <LoaderCircle
                    size={18}
                    className="animate-spin text-slate-500"
                  />
                )}

              </div>

              {audioUrl ? (
                <div className="mt-5">

                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onTimeUpdate={
                      handleAudioTimeUpdate
                    }
                    onLoadedMetadata={
                      handleAudioLoaded
                    }
                    onPlay={() =>
                      setIsPlaying(
                        true
                      )
                    }
                    onPause={() =>
                      setIsPlaying(
                        false
                      )
                    }
                    className="hidden"
                  />

                  <div className="flex items-center gap-4">

                    <button
                      onClick={
                        toggleAudio
                      }
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700"
                    >
                      {isPlaying ? (
                        <Pause
                          size={18}
                        />
                      ) : (
                        <Play
                          size={18}
                          className="ml-0.5"
                        />
                      )}
                    </button>

                    <div className="flex-1">

                      <input
                        type="range"
                        min="0"
                        max={
                          audioDuration ||
                          0
                        }
                        step="0.1"
                        value={
                          Math.min(
                            audioCurrentTime,
                            audioDuration ||
                              0
                          )
                        }
                        onChange={(
                          event
                        ) => {
                          const value =
                            Number(
                              event
                                .target
                                .value
                            );

                          if (
                            audioRef.current
                          ) {
                            audioRef.current.currentTime =
                              value;
                          }

                          setAudioCurrentTime(
                            value
                          );
                        }}
                        className="w-full"
                      />

                      <div className="mt-1 flex justify-between text-xs text-slate-400">

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

                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">
                  Audio is not available.
                </p>
              )}

            </section>

            {/* TRANSCRIPT */}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b p-5">

                <div className="flex flex-col gap-3 md:flex-row">

                  <div className="relative flex-1">

                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={
                        transcriptSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setTranscriptSearch(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Search transcript..."
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
                    />

                  </div>

                  <select
                    value={
                      speakerFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setSpeakerFilter(
                        event
                          .target
                          .value
                      )
                    }
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none"
                  >
                    <option value="all">
                      All speakers
                    </option>

                    {speakers.map(
                      (
                        speaker
                      ) => (
                        <option
                          key={
                            speaker
                          }
                          value={
                            speaker
                          }
                        >
                          {speaker}
                        </option>
                      )
                    )}

                  </select>

                </div>

              </div>

              <div className="max-h-[650px] overflow-y-auto p-5">

                {filteredTranscript.length >
                0 ? (
                  <div className="space-y-3">

                    {filteredTranscript.map(
                      (
                        segment
                      ) => {

                        const active =
                          segment.originalIndex ===
                          activeSegmentIndex;

                        return (
                          <div
                            key={`${segment.originalIndex}-${segment.start}`}
                            ref={(
                              element
                            ) => {
                              transcriptRefs.current[
                                segment.originalIndex
                              ] =
                                element;
                            }}
                            className={`rounded-lg border p-4 transition ${
                              active
                                ? "border-slate-400 bg-slate-100 shadow-sm"
                                : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                            }`}
                          >

                            <div className="flex items-start gap-3">

                              <button
                                onClick={() =>
                                  jumpToTimestamp(
                                    segment.start
                                  )
                                }
                                className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                              >
                                {formatTimestamp(
                                  segment.start
                                )}
                              </button>

                              <div className="min-w-0">

                                <div className="mb-1 flex items-center gap-2">

                                  <span className="text-xs font-semibold text-slate-700">
                                    {segment.speaker ||
                                      "Unknown speaker"}
                                  </span>

                                  {active && (
                                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">
                                      Playing
                                    </span>
                                  )}

                                </div>

                                <p className="text-sm leading-6 text-slate-700">
                                  {
                                    segment.text
                                  }
                                </p>

                              </div>

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>
                ) : (
                  <div className="py-12 text-center">

                    <FileText
                      size={32}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm text-slate-500">
                      No transcript segments found.
                    </p>

                  </div>
                )}

              </div>

            </section>

          </div>
        )}

        {/* ===================================================
            SPEAKERS
        ==================================================== */}

        {activeTab ===
          "speakers" && (
          <div className="space-y-6">

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-center gap-3">

                <div className="rounded-lg bg-slate-100 p-3">
                  <Users
                    size={20}
                    className="text-slate-700"
                  />
                </div>

                <div>

                  <h2 className="text-lg font-semibold text-slate-900">
                    Speaker Intelligence
                  </h2>

                  <p className="text-sm text-slate-500">
                    Participation and speaking patterns.
                  </p>

                </div>

              </div>

              {speakerAnalytics.length >
              0 ? (
                <div className="mt-6 overflow-x-auto">

                  <table className="w-full min-w-[600px] text-left">

                    <thead>

                      <tr className="border-b text-xs uppercase tracking-wide text-slate-500">

                        <th className="px-4 py-3">
                          Speaker
                        </th>

                        <th className="px-4 py-3">
                          Speaking Time
                        </th>

                        <th className="px-4 py-3">
                          Words
                        </th>

                        <th className="px-4 py-3">
                          Participation
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {speakerAnalytics.map(
                        (
                          speaker,
                          index
                        ) => {

                          const totalTime =
                            speakerAnalytics.reduce(
                              (
                                sum,
                                item
                              ) =>
                                sum +
                                Number(
                                  item.speaking_time ||
                                    0
                                ),
                              0
                            );

                          const percentage =
                            totalTime >
                            0
                              ? (
                                  Number(
                                    speaker.speaking_time ||
                                      0
                                  ) /
                                  totalTime
                                ) *
                                100
                              : 0;

                          return (
                            <tr
                              key={
                                speaker.id ||
                                index
                              }
                              className="border-b last:border-0"
                            >

                              <td className="px-4 py-4 font-medium text-slate-800">
                                {
                                  speaker.speaker
                                }
                              </td>

                              <td className="px-4 py-4 text-sm text-slate-600">
                                {formatDuration(
                                  speaker.speaking_time
                                )}
                              </td>

                              <td className="px-4 py-4 text-sm text-slate-600">
                                {
                                  speaker.word_count ||
                                  0
                                }
                              </td>

                              <td className="px-4 py-4">

                                <div className="flex items-center gap-3">

                                  <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">

                                    <div
                                      className="h-full rounded-full bg-slate-700"
                                      style={{
                                        width: `${Math.min(
                                          percentage,
                                          100
                                        )}%`
                                      }}
                                    />

                                  </div>

                                  <span className="text-xs text-slate-500">
                                    {percentage.toFixed(
                                      0
                                    )}
                                    %
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
              ) : (
                <div className="py-12 text-center">

                  <Users
                    size={32}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-3 text-sm text-slate-500">
                    Speaker analytics are not available yet.
                  </p>

                </div>
              )}

            </section>

          </div>
        )}

        {/* ===================================================
            ACTION ITEMS
        ==================================================== */}

        {activeTab ===
          "actions" && (
          <div className="space-y-6">

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

              {[
                [
                  "Total",
                  actionStats.total
                ],
                [
                  "Pending",
                  actionStats.pending
                ],
                [
                  "In Progress",
                  actionStats.inProgress
                ],
                [
                  "Completed",
                  actionStats.completed
                ],
                [
                  "Overdue",
                  actionStats.overdue
                ]
              ].map(
                (
                  [label, value]
                ) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >

                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {label}
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {value}
                    </p>

                  </div>
                )
              )}

            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

              <div className="flex flex-wrap gap-2 border-b p-5">

                {[
                  ["all", "All"],
                  ["pending", "Pending"],
                  [
                    "in_progress",
                    "In Progress"
                  ],
                  [
                    "completed",
                    "Completed"
                  ],
                  [
                    "overdue",
                    "Overdue"
                  ]
                ].map(
                  (
                    [
                      value,
                      label
                    ]
                  ) => (
                    <button
                      key={value}
                      onClick={() =>
                        setActionFilter(
                          value
                        )
                      }
                      className={`rounded-lg px-3 py-2 text-sm font-medium ${
                        actionFilter ===
                        value
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  )
                )}

              </div>

              <div className="divide-y">

                {filteredActionItems.length >
                0 ? (
                  filteredActionItems.map(
                    (item) => (
                      <div
                        key={item.id}
                        className="p-5"
                      >

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                          <div className="min-w-0">

                            <div className="flex items-start gap-3">

                              <div className="mt-0.5 rounded-lg bg-slate-100 p-2">

                                <ListChecks
                                  size={17}
                                  className="text-slate-600"
                                />

                              </div>

                              <div>

                                <p className="font-medium text-slate-900">
                                  {
                                    item.task
                                  }
                                </p>

                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">

                                  {item.assigned_to && (
                                    <span>
                                      Assigned to:{" "}
                                      {
                                        item.assigned_to
                                      }
                                    </span>
                                  )}

                                  {item.deadline && (
                                    <span>
                                      Deadline:{" "}
                                      {
                                        item.deadline
                                      }
                                    </span>
                                  )}

                                </div>

                              </div>

                            </div>

                          </div>

                          <div className="flex flex-wrap items-center gap-2">

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityStyle(
                                item.priority
                              )}`}
                            >
                              {item.priority ||
                                "medium"}
                            </span>

                            {isOverdue(
                              item
                            ) && (
                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                                Overdue
                              </span>
                            )}

                            <select
                              value={
                                item.status ||
                                "pending"
                              }
                              disabled={
                                actionUpdating ===
                                item.id
                              }
                              onChange={(
                                event
                              ) =>
                                updateActionItem(
                                  item.id,
                                  {
                                    status:
                                      event
                                        .target
                                        .value
                                  }
                                )
                              }
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none"
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
                  )
                ) : (
                  <div className="py-14 text-center">

                    <CheckCircle2
                      size={34}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 text-sm text-slate-500">
                      No action items found.
                    </p>

                  </div>
                )}

              </div>

            </section>

          </div>
        )}

        {/* ===================================================
            AI INSIGHTS
        ==================================================== */}

        {activeTab ===
          "ai" && (
          <div className="space-y-6">

            {/* COPILOT */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-start gap-3">

                <div className="rounded-xl bg-slate-900 p-3 text-white">
                  <Brain
                    size={21}
                  />
                </div>

                <div>

                  <h2 className="text-lg font-semibold text-slate-900">
                    AI Meeting Copilot
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Ask questions grounded in this meeting.
                  </p>

                </div>

              </div>

              <div className="mt-5 flex flex-wrap gap-2">

                {suggestedQuestions.map(
                  (
                    suggestion
                  ) => (
                    <button
                      key={
                        suggestion
                      }
                      type="button"
                      onClick={() =>
                        setCopilotQuestion(
                          suggestion
                        )
                      }
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {suggestion}
                    </button>
                  )
                )}

              </div>

              <form
                onSubmit={
                  askCopilot
                }
                className="mt-4 flex gap-2"
              >

                <input
                  value={
                    copilotQuestion
                  }
                  onChange={(
                    event
                  ) =>
                    setCopilotQuestion(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Ask something about this meeting..."
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />

                <button
                  type="submit"
                  disabled={
                    copilotLoading ||
                    !copilotQuestion.trim()
                  }
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copilotLoading ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Send
                      size={16}
                    />
                  )}

                  Ask
                </button>

              </form>

              {copilotError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {copilotError}
                </div>
              )}

              {copilotAnswer && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    AI Answer
                  </p>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                    {copilotAnswer}
                  </p>

                  {/* SOURCES */}

                  {copilotSources.length >
                    0 && (
                    <div className="mt-6">

                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Sources from meeting
                      </p>

                      <div className="space-y-2">

                        {copilotSources.map(
                          (
                            source,
                            index
                          ) => (
                            <button
                              key={
                                index
                              }
                              type="button"
                              onClick={() =>
                                jumpToTimestamp(
                                  source.start
                                )
                              }
                              className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 hover:bg-slate-50"
                            >

                              <div className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                {formatTimestamp(
                                  source.start
                                )}
                              </div>

                              <div className="min-w-0">

                                <p className="text-xs leading-5 text-slate-600">
                                  {
                                    source.text
                                  }
                                </p>

                                <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                                  Jump to transcript
                                  <ChevronRight
                                    size={11}
                                  />
                                </p>

                              </div>

                            </button>
                          )
                        )}

                      </div>

                    </div>
                  )}

                </div>
              )}

            </section>

            {/* INSIGHTS */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-center gap-3">

                <Sparkles
                  size={20}
                  className="text-slate-700"
                />

                <div>

                  <h2 className="text-lg font-semibold text-slate-900">
                    AI Insights
                  </h2>

                  <p className="text-sm text-slate-500">
                    Observations generated from the meeting.
                  </p>

                </div>

              </div>

              {insights.length >
              0 ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">

                  {insights.map(
                    (
                      insight,
                      index
                    ) => (
                      <div
                        key={index}
                        className={`rounded-xl border p-5 ${getInsightStyle(
                          insight.type
                        )}`}
                      >

                        <p className="font-semibold text-slate-900">
                          {
                            insight.title
                          }
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {
                            insight.description
                          }
                        </p>

                      </div>
                    )
                  )}

                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">
                  No AI insights available yet.
                </p>
              )}

            </section>

            {/* RECOMMENDATIONS */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <h2 className="text-lg font-semibold text-slate-900">
                AI Recommendations
              </h2>

              {recommendations.length >
              0 ? (
                <ol className="mt-5 space-y-3">

                  {recommendations.map(
                    (
                      recommendation,
                      index
                    ) => (
                      <li
                        key={index}
                        className="flex gap-3 rounded-lg bg-slate-50 p-4"
                      >

                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          {index +
                            1}
                        </span>

                        <span className="text-sm leading-6 text-slate-700">
                          {
                            recommendation
                          }
                        </span>

                      </li>
                    )
                  )}

                </ol>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No recommendations available yet.
                </p>
              )}

            </section>

          </div>
        )}

        {/* ===================================================
            ANALYTICS
        ==================================================== */}

        {activeTab ===
          "analytics" && (
          <div className="space-y-6">

            {/* SENTIMENT */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-center gap-3">

                <MessageSquare
                  size={20}
                  className="text-slate-700"
                />

                <div>

                  <h2 className="text-lg font-semibold text-slate-900">
                    Sentiment Overview
                  </h2>

                  <p className="text-sm text-slate-500">
                    Sentiment distribution across transcript segments.
                  </p>

                </div>

              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">

                <div className="rounded-xl border border-green-200 bg-green-50 p-5">

                  <p className="text-sm font-medium text-green-700">
                    Positive
                  </p>

                  <p className="mt-2 text-3xl font-bold text-green-800">
                    {meeting.positive_sentiment ??
                      0}
                  </p>

                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-5">

                  <p className="text-sm font-medium text-red-700">
                    Negative
                  </p>

                  <p className="mt-2 text-3xl font-bold text-red-800">
                    {meeting.negative_sentiment ??
                      0}
                  </p>

                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

                  <p className="text-sm font-medium text-slate-600">
                    Neutral
                  </p>

                  <p className="mt-2 text-3xl font-bold text-slate-800">
                    {meeting.neutral_sentiment ??
                      0}
                  </p>

                </div>

              </div>

            </section>

            {/* MEETING METRICS */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <h2 className="text-lg font-semibold text-slate-900">
                Meeting Metrics
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                <div className="rounded-lg bg-slate-50 p-4">

                  <p className="text-xs text-slate-500">
                    Duration
                  </p>

                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {formatDuration(
                      meeting.duration
                    )}
                  </p>

                </div>

                <div className="rounded-lg bg-slate-50 p-4">

                  <p className="text-xs text-slate-500">
                    Total Words
                  </p>

                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {meeting.total_words ||
                      0}
                  </p>

                </div>

                <div className="rounded-lg bg-slate-50 p-4">

                  <p className="text-xs text-slate-500">
                    Speakers
                  </p>

                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {meeting.speaker_count ||
                      0}
                  </p>

                </div>

                <div className="rounded-lg bg-slate-50 p-4">

                  <p className="text-xs text-slate-500">
                    Action Items
                  </p>

                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {
                      actionStats.total
                    }
                  </p>

                </div>

              </div>

            </section>

            {/* SCORE */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-lg font-semibold text-slate-900">
                    Effectiveness Score
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Overall meeting performance.
                  </p>

                </div>

                <div className="text-4xl font-bold text-slate-900">
                  {score ??
                    "—"}
                </div>

              </div>

              {Object.keys(
                scoreBreakdown
              ).length >
                0 && (
                <div className="mt-6 space-y-4">

                  {Object.entries(
                    scoreBreakdown
                  ).map(
                    (
                      [
                        key,
                        value
                      ]
                    ) => {

                      const numericValue =
                        Number(
                          value
                        ) || 0;

                      return (
                        <div
                          key={key}
                        >

                          <div className="mb-1 flex justify-between text-xs">

                            <span className="capitalize text-slate-600">
                              {key.replace(
                                /_/g,
                                " "
                              )}
                            </span>

                            <span className="font-medium text-slate-700">
                              {
                                numericValue
                              }
                            </span>

                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">

                            <div
                              className="h-full rounded-full bg-slate-700"
                              style={{
                                width: `${Math.min(
                                  numericValue,
                                  100
                                )}%`
                              }}
                            />

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </section>

          </div>
        )}

      </main>

    </div>
  );
}
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle,
  Clock,
  Download,
  FileAudio,
  FileText,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Users,
  Volume2,
  X
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";


export default function MeetingDetails() {

  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  const [meeting, setMeeting] = useState(null);

  const [transcript, setTranscript] = useState(null);

  const [actionItems, setActionItems] = useState([]);

  const [speakerAnalytics, setSpeakerAnalytics] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("overview");

  const [processing, setProcessing] = useState(false);

  const [liveProgress, setLiveProgress] = useState(null);

  // Transcript
  const [transcriptSearch, setTranscriptSearch] = useState("");

  const [speakerFilter, setSpeakerFilter] = useState("all");

  // Audio
  const [audioUrl, setAudioUrl] = useState("");

  const [audioCurrentTime, setAudioCurrentTime] =
    useState(0);

  const [audioDuration, setAudioDuration] =
    useState(0);

  // Action items
  const [actionFilter, setActionFilter] =
    useState("all");

  const [updatingAction, setUpdatingAction] =
    useState(null);


  // --------------------------------------------------
  // REFS
  // --------------------------------------------------

  const audioRef = useRef(null);

  const transcriptRefs = useRef([]);

  const lastActiveSegment = useRef(-1);


  // --------------------------------------------------
  // TABS
  // --------------------------------------------------

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      icon: Target
    },
    {
      id: "transcript",
      label: "Transcript",
      icon: MessageSquareText
    },
    {
      id: "speakers",
      label: "Speakers",
      icon: Users
    },
    {
      id: "actions",
      label: "Action Items",
      icon: CheckCircle
    },
    {
      id: "ai",
      label: "AI Insights",
      icon: Sparkles
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: Target
    }
  ];


  // --------------------------------------------------
  // FETCH MEETING
  // --------------------------------------------------

  const loadMeeting = async () => {

    try {

      const response = await api.get(
        `/meetings/${meetingId}`
      );

      setMeeting(response.data);

      return response.data;

    } catch (err) {

      console.error(
        "Meeting loading error:",
        err
      );

      if (err.response?.status === 401) {
        logout();
        return null;
      }

      throw err;
    }
  };


  // --------------------------------------------------
  // FETCH TRANSCRIPT
  // --------------------------------------------------

  const loadTranscript = async () => {

    try {

      const response = await api.get(
        `/meetings/${meetingId}/transcript`
      );

      setTranscript(response.data);

    } catch (err) {

      if (err.response?.status === 404) {

        setTranscript(null);

        return;
      }

      console.error(
        "Transcript loading error:",
        err
      );
    }
  };


  // --------------------------------------------------
  // FETCH ACTION ITEMS
  // --------------------------------------------------

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

      if (err.response?.status === 404) {

        setActionItems([]);

        return;
      }

      console.error(
        "Action items loading error:",
        err
      );
    }
  };


  // --------------------------------------------------
  // FETCH SPEAKER ANALYTICS
  // --------------------------------------------------

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

      if (err.response?.status === 404) {

        setSpeakerAnalytics([]);

        return;
      }

      console.error(
        "Speaker analytics error:",
        err
      );
    }
  };


  // --------------------------------------------------
  // LOAD ALL DATA
  // --------------------------------------------------

  const loadAllData = async () => {

    try {

      setLoading(true);
      setError("");

      await Promise.all([
        loadMeeting(),
        loadTranscript(),
        loadActionItems(),
        loadSpeakerAnalytics()
      ]);

    } catch (err) {

      setError(
        err.response?.data?.detail ||
        "Unable to load meeting."
      );

    } finally {

      setLoading(false);
    }
  };


  useEffect(() => {

    if (!meetingId) return;

    loadAllData();

  }, [meetingId]);


  // --------------------------------------------------
  // WEBSOCKET
  // --------------------------------------------------

  useEffect(() => {

    if (!meetingId) return;

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
            status: data.status,
            processing_stage:
              data.stage,
            processing_message:
              data.message,
            processing_progress:
              data.progress
          };

        });


        if (
          data.status === "completed"
        ) {

          setProcessing(false);

          loadAllData();

        }


        if (
          data.status === "processing_failed" ||
          data.status === "analysis_failed"
        ) {

          setProcessing(false);

        }

      } catch (err) {

        console.error(
          "WebSocket message error:",
          err
        );

      }

    };


    socket.onerror = (err) => {

      console.error(
        "WebSocket error:",
        err
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


  // --------------------------------------------------
  // AUDIO URL
  // --------------------------------------------------

  const loadAudio = async () => {

    try {

      const response = await api.get(
        `/meetings/${meetingId}/audio`,
        {
          responseType: "blob"
        }
      );

      const url = URL.createObjectURL(
        response.data
      );

      setAudioUrl(url);

    } catch (err) {

      console.error(
        "Audio loading error:",
        err
      );

    }

  };


  useEffect(() => {

    if (!meetingId) return;

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


  // --------------------------------------------------
  // PROCESS MEETING
  // --------------------------------------------------

  const processMeeting = async () => {

    try {

      setProcessing(true);

      setError("");

      const response = await api.post(
        `/meetings/${meetingId}/process`
      );

      console.log(
        "Processing started:",
        response.data
      );

      setLiveProgress({
        status: "processing",
        stage: "starting",
        message:
          "Starting meeting processing...",
        progress: 5
      });

    } catch (err) {

      console.error(
        "Processing error:",
        err
      );

      setProcessing(false);

      setError(
        err.response?.data?.detail ||
        "Unable to start processing."
      );

    }

  };


  // --------------------------------------------------
  // DIARIZE
  // --------------------------------------------------

  const diarizeMeeting = async () => {

    try {

      setProcessing(true);

      await api.post(
        `/meetings/${meetingId}/diarize`
      );

      await loadAllData();

    } catch (err) {

      setError(
        err.response?.data?.detail ||
        "Speaker identification failed."
      );

    } finally {

      setProcessing(false);

    }

  };


  // --------------------------------------------------
  // ANALYZE
  // --------------------------------------------------

  const analyzeMeeting = async () => {

    try {

      setProcessing(true);

      setError("");

      await api.post(
        `/meetings/${meetingId}/analyze`
      );

      await loadAllData();

    } catch (err) {

      console.error(
        "Analysis error:",
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


  // --------------------------------------------------
  // AUDIO HANDLERS
  // --------------------------------------------------

  const handleAudioTimeUpdate = () => {

    if (!audioRef.current) return;

    setAudioCurrentTime(
      audioRef.current.currentTime
    );

  };


  const handleAudioLoaded = () => {

    if (!audioRef.current) return;

    setAudioDuration(
      audioRef.current.duration || 0
    );

  };


  const jumpToTimestamp = (seconds) => {

    if (!audioRef.current) return;

    audioRef.current.currentTime =
      Number(seconds) || 0;

    setAudioCurrentTime(
      Number(seconds) || 0
    );

    audioRef.current.play().catch(() => {});

  };


  const formatTimestamp = (seconds) => {

    const value = Number(seconds) || 0;

    const minutes = Math.floor(
      value / 60
    );

    const remainingSeconds = Math.floor(
      value % 60
    );

    return `${String(minutes).padStart(
      2,
      "0"
    )}:${String(remainingSeconds).padStart(
      2,
      "0"
    )}`;

  };


  const formatDuration = (seconds) => {

    if (!seconds || Number.isNaN(seconds)) {
      return "00:00";
    }

    return formatTimestamp(seconds);

  };


  // --------------------------------------------------
  // TRANSCRIPT SEGMENTS
  // --------------------------------------------------

  const transcriptSegments = useMemo(() => {

    if (
      !transcript ||
      !Array.isArray(transcript.segments)
    ) {

      return [];

    }

    return transcript.segments;

  }, [transcript]);


  const speakers = useMemo(() => {

    return [
      ...new Set(
        transcriptSegments
          .map(
            (segment) =>
              segment.speaker
          )
          .filter(Boolean)
      )
    ];

  }, [transcriptSegments]);


  const filteredTranscript = useMemo(() => {

    const search =
      transcriptSearch
        .trim()
        .toLowerCase();

    return transcriptSegments.filter(
      (segment) => {

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

      }
    );

  }, [
    transcriptSegments,
    transcriptSearch,
    speakerFilter
  ]);


  // --------------------------------------------------
  // ACTIVE TRANSCRIPT SEGMENT
  // --------------------------------------------------

  const activeSegmentIndex = useMemo(() => {

    if (!transcriptSegments.length) {
      return -1;
    }

    return transcriptSegments.findIndex(
      (segment) =>
        audioCurrentTime >=
          Number(segment.start) &&
        audioCurrentTime <
          Number(segment.end)
    );

  }, [
    transcriptSegments,
    audioCurrentTime
  ]);


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


  // --------------------------------------------------
  // ACTION ITEM FILTER
  // --------------------------------------------------

  const isOverdue = (item) => {

    if (!item.deadline) {
      return false;
    }

    if (
      item.status === "completed"
    ) {

      return false;

    }

    const deadline =
      new Date(item.deadline);

    if (
      Number.isNaN(
        deadline.getTime()
      )
    ) {

      return false;

    }

    return deadline < new Date();

  };


  const filteredActionItems =
    useMemo(() => {

      return actionItems.filter(
        (item) => {

          if (
            actionFilter === "overdue"
          ) {

            return isOverdue(item);

          }

          if (
            actionFilter === "all"
          ) {

            return true;

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


  // --------------------------------------------------
  // ACTION ITEM UPDATE
  // --------------------------------------------------

  const updateActionItem = async (
    item,
    changes
  ) => {

    try {

      setUpdatingAction(item.id);

      /*
       * The backend accepts the action item
       * update through the meeting action-item route.
       */

      const response = await api.put(
        `/meetings/${meetingId}/action-items/${item.id}`,
        changes
      );

      const updated =
        response.data;

      setActionItems(
        (previous) =>
          previous.map(
            (current) =>
              current.id === item.id
                ? updated
                : current
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

      setUpdatingAction(null);

    }

  };


  // --------------------------------------------------
  // DOWNLOAD PDF
  // --------------------------------------------------

  const downloadReport = async () => {

    try {

      const response = await api.get(
        `/meetings/${meetingId}/report`,
        {
          responseType: "blob"
        }
      );

      const url =
        window.URL.createObjectURL(
          new Blob([response.data])
        );

      const link =
        document.createElement("a");

      link.href = url;

      link.setAttribute(
        "download",
        `meeting_report_${meetingId}.pdf`
      );

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

    } catch (err) {

      console.error(
        "Report download error:",
        err
      );

      setError(
        err.response?.data?.detail ||
        "Unable to download report."
      );

    }

  };


  // --------------------------------------------------
  // PARSE JSON SAFELY
  // --------------------------------------------------

  const parseJSON = (
    value,
    fallback = []
  ) => {

    if (!value) {
      return fallback;
    }

    if (
      Array.isArray(value)
    ) {

      return value;

    }

    try {

      const parsed =
        JSON.parse(value);

      return parsed;

    } catch {

      return fallback;

    }

  };


  const keyPoints =
    parseJSON(
      meeting?.key_points,
      []
    );


  const decisions =
    parseJSON(
      meeting?.decisions,
      []
    );


  const insights =
    parseJSON(
      meeting?.meeting_insights,
      []
    );


  const recommendations =
    parseJSON(
      meeting?.meeting_recommendations,
      []
    );


  // --------------------------------------------------
  // SCORE BREAKDOWN
  // --------------------------------------------------

  const scoreBreakdown =
    meeting?.score_breakdown ||
    meeting?.meeting_score?.breakdown ||
    null;


  const effectivenessScore =
    meeting?.effectiveness_score ??
    meeting?.meeting_score?.score ??
    null;


  const effectivenessRating =
    meeting?.effectiveness_rating ??
    meeting?.meeting_score?.rating ??
    "";


  // --------------------------------------------------
  // STATUS
  // --------------------------------------------------

  const getStatusStyle = (
    status
  ) => {

    const normalized =
      status?.toLowerCase();

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

    return "bg-gray-100 text-gray-600";

  };


  const getReadableStatus = (
    status
  ) => {

    if (!status) {
      return "Unknown";
    }

    return status
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (char) =>
          char.toUpperCase()
      );

  };


  // --------------------------------------------------
  // PROCESSING DATA
  // --------------------------------------------------

  const progress =
    liveProgress?.progress ??
    meeting?.processing_progress ??
    0;


  const progressMessage =
    liveProgress?.message ||
    meeting?.processing_message ||
    "Preparing meeting...";


  // --------------------------------------------------
  // ACTION STATS
  // --------------------------------------------------

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


  const completedActionCount =
    actionItems.filter(
      (item) =>
        item.status === "completed"
    ).length;


  const overdueCount =
    actionItems.filter(
      (item) =>
        isOverdue(item)
    ).length;


  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">

        <div className="text-center">

          <LoaderCircle
            size={36}
            className="mx-auto animate-spin text-slate-600"
          />

          <p className="mt-4 text-sm text-slate-500">
            Loading meeting...
          </p>

        </div>

      </div>
    );

  }


  // --------------------------------------------------
  // MEETING NOT FOUND
  // --------------------------------------------------

  if (!meeting) {

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">

        <div className="text-center">

          <FileText
            size={42}
            className="mx-auto text-slate-400"
          />

          <h2 className="mt-4 text-xl font-semibold">
            Meeting not found
          </h2>

          <button
            onClick={() =>
              navigate("/dashboard")
            }
            className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white"
          >
            Back to Dashboard
          </button>

        </div>

      </div>
    );

  }


  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (

    <div className="min-h-screen bg-slate-50">

      {/* ============================================ */}
      {/* NAVBAR */}
      {/* ============================================ */}

      <header className="border-b bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          <div>

            <h1 className="text-xl font-bold text-slate-900">
              Smart AI Meeting Assistant
            </h1>

            <p className="text-sm text-slate-500">
              Meeting intelligence workspace
            </p>

          </div>

          <button
            onClick={logout}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Logout
          </button>

        </div>

      </header>


      {/* ============================================ */}
      {/* MAIN */}
      {/* ============================================ */}

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* BACK */}

        <button
          onClick={() =>
            navigate("/dashboard")
          }
          className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Back to meetings
        </button>


        {/* ======================================== */}
        {/* HEADER */}
        {/* ======================================== */}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

            <div>

              <div className="flex flex-wrap items-center gap-3">

                <h2 className="text-2xl font-bold text-slate-900">

                  {meeting.title ||
                    `Meeting #${meeting.id}`}

                </h2>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(
                    meeting.status
                  )}`}
                >
                  {getReadableStatus(
                    meeting.status
                  )}
                </span>

              </div>


              <p className="mt-2 text-sm text-slate-500">
                {meeting.file_name}
              </p>


              <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-500">

                <span className="flex items-center gap-1.5">
                  <CalendarDays size={15} />

                  {meeting.created_at
                    ? new Date(
                        meeting.created_at
                      ).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        }
                      )
                    : "Date unavailable"}
                </span>


                <span className="flex items-center gap-1.5">
                  <Clock size={15} />

                  {meeting.duration
                    ? formatDuration(
                        meeting.duration
                      )
                    : "Duration unavailable"}
                </span>


                <span className="flex items-center gap-1.5">
                  <FileText size={15} />

                  {meeting.total_words ||
                    0}{" "}
                  words
                </span>


                <span className="flex items-center gap-1.5">
                  <Users size={15} />

                  {meeting.speaker_count ||
                    0}{" "}
                  speakers
                </span>

              </div>

            </div>


            {/* ACTION BUTTONS */}

            <div className="flex flex-wrap gap-2">

              <button
                onClick={loadAllData}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw size={16} />
                Refresh
              </button>


              <button
                onClick={downloadReport}
                disabled={
                  meeting.status !==
                  "completed"
                }
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={16} />
                Report
              </button>

            </div>

          </div>


          {/* ====================================== */}
          {/* PROCESSING BAR */}
          {/* ====================================== */}

          {meeting.status !==
            "completed" && (

            <div className="mt-6 border-t pt-5">

              <div className="mb-2 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  {processing && (
                    <LoaderCircle
                      size={15}
                      className="animate-spin text-blue-600"
                    />
                  )}

                  <span className="text-sm text-slate-600">
                    {progressMessage}
                  </span>

                </div>

                <span className="text-sm font-semibold text-slate-700">
                  {progress}%
                </span>

              </div>


              <div className="h-2 overflow-hidden rounded-full bg-slate-100">

                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-700"
                  style={{
                    width: `${progress}%`
                  }}
                />

              </div>

            </div>

          )}

        </div>


        {/* ======================================== */}
        {/* ERROR */}
        {/* ======================================== */}

        {error && (

          <div className="mt-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

            <span>
              {error}
            </span>

            <button
              onClick={() =>
                setError("")
              }
            >
              <X size={18} />
            </button>

          </div>

        )}


        {/* ======================================== */}
        {/* TABS */}
        {/* ======================================== */}

        <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200">

            <div className="flex overflow-x-auto">

              {tabs.map((tab) => {

                const Icon =
                  tab.icon;

                return (

                  <button
                    key={tab.id}
                    onClick={() =>
                      setActiveTab(
                        tab.id
                      )
                    }
                    className={`
                      flex
                      items-center
                      gap-2
                      whitespace-nowrap
                      border-b-2
                      px-5
                      py-4
                      text-sm
                      font-medium
                      transition
                      ${
                        activeTab ===
                        tab.id
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-900"
                      }
                    `}
                  >

                    <Icon size={16} />

                    {tab.label}

                  </button>

                );

              })}

            </div>

          </div>


          {/* ====================================== */}
          {/* TAB CONTENT */}
          {/* ====================================== */}

          <div className="p-6">


            {/* ================================== */}
            {/* OVERVIEW */}
            {/* ================================== */}

            {activeTab ===
              "overview" && (

              <div className="space-y-6">


                {/* KPI CARDS */}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                  <div className="rounded-xl border border-slate-200 p-5">

                    <p className="text-sm text-slate-500">
                      Words
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {meeting.total_words ||
                        0}
                    </p>

                  </div>


                  <div className="rounded-xl border border-slate-200 p-5">

                    <p className="text-sm text-slate-500">
                      Speakers
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {meeting.speaker_count ||
                        0}
                    </p>

                  </div>


                  <div className="rounded-xl border border-slate-200 p-5">

                    <p className="text-sm text-slate-500">
                      Action Items
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {actionItems.length}
                    </p>

                  </div>


                  <div className="rounded-xl border border-slate-200 p-5">

                    <p className="text-sm text-slate-500">
                      Effectiveness
                    </p>

                    <p className="mt-2 text-2xl font-bold text-blue-600">
                      {effectivenessScore ??
                        "-"}
                      {effectivenessScore !==
                        null &&
                        "/100"}
                    </p>

                  </div>

                </div>


                {/* SUMMARY */}

                <section>

                  <h3 className="text-lg font-semibold text-slate-900">
                    Executive Summary
                  </h3>

                  <div className="mt-3 rounded-xl bg-slate-50 p-5">

                    <p className="leading-7 text-slate-700">
                      {meeting.summary ||
                        "No summary available yet."}
                    </p>

                  </div>

                </section>


                {/* KEY POINTS */}

                <section>

                  <h3 className="text-lg font-semibold text-slate-900">
                    Key Points
                  </h3>

                  {keyPoints.length >
                  0 ? (

                    <ul className="mt-3 space-y-3">

                      {keyPoints.map(
                        (
                          point,
                          index
                        ) => (

                          <li
                            key={index}
                            className="flex gap-3 rounded-lg border border-slate-200 p-4"
                          >

                            <CheckCircle
                              size={18}
                              className="mt-0.5 shrink-0 text-green-600"
                            />

                            <span className="text-sm leading-6 text-slate-700">
                              {point}
                            </span>

                          </li>

                        )
                      )}

                    </ul>

                  ) : (

                    <p className="mt-3 text-sm text-slate-500">
                      No key points available.
                    </p>

                  )}

                </section>


                {/* DECISIONS */}

                <section>

                  <h3 className="text-lg font-semibold text-slate-900">
                    Decisions
                  </h3>

                  {decisions.length >
                  0 ? (

                    <ul className="mt-3 space-y-3">

                      {decisions.map(
                        (
                          decision,
                          index
                        ) => (

                          <li
                            key={index}
                            className="rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-700"
                          >
                            {decision}
                          </li>

                        )
                      )}

                    </ul>

                  ) : (

                    <p className="mt-3 text-sm text-slate-500">
                      No decisions recorded.
                    </p>

                  )}

                </section>


                {/* SCORE */}

                <section>

                  <h3 className="text-lg font-semibold text-slate-900">
                    Meeting Effectiveness
                  </h3>

                  <div className="mt-4 rounded-xl border border-slate-200 p-6">

                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

                      <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-8 border-blue-100">

                        <div className="text-center">

                          <p className="text-2xl font-bold text-blue-600">
                            {effectivenessScore ??
                              "-"}
                          </p>

                          <p className="text-xs text-slate-500">
                            / 100
                          </p>

                        </div>

                      </div>


                      <div>

                        <h4 className="text-lg font-semibold text-slate-900">
                          {effectivenessRating ||
                            "Not calculated"}
                        </h4>

                        <p className="mt-1 text-sm text-slate-500">
                          Based on participation,
                          sentiment, action items,
                          transcript quality and
                          meeting efficiency.
                        </p>

                      </div>

                    </div>


                    {scoreBreakdown && (

                      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

                        {Object.entries(
                          scoreBreakdown
                        ).map(
                          ([
                            key,
                            value
                          ]) => (

                            <div
                              key={key}
                              className="rounded-lg bg-slate-50 p-4"
                            >

                              <p className="text-xs capitalize text-slate-500">
                                {key.replaceAll(
                                  "_",
                                  " "
                                )}
                              </p>

                              <p className="mt-1 text-lg font-bold text-slate-800">
                                {value}
                              </p>

                            </div>

                          )
                        )}

                      </div>

                    )}

                  </div>

                </section>

              </div>

            )}


            {/* ================================== */}
            {/* TRANSCRIPT */}
            {/* ================================== */}

            {activeTab ===
              "transcript" && (

              <div className="space-y-6">


                {/* AUDIO */}

                <section>

                  <div className="mb-4">

                    <h3 className="text-lg font-semibold text-slate-900">
                      Meeting Audio
                    </h3>

                    <p className="text-sm text-slate-500">
                      Listen and jump directly to transcript timestamps.
                    </p>

                  </div>


                  {audioUrl ? (

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

                      <div className="mb-3 flex items-center gap-2">

                        <Volume2
                          size={18}
                          className="text-slate-600"
                        />

                        <span className="text-sm font-medium text-slate-700">
                          {formatTimestamp(
                            audioCurrentTime
                          )}{" "}
                          /{" "}
                          {formatTimestamp(
                            audioDuration
                          )}
                        </span>

                      </div>


                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        controls
                        className="w-full"
                        onTimeUpdate={
                          handleAudioTimeUpdate
                        }
                        onLoadedMetadata={
                          handleAudioLoaded
                        }
                      />

                    </div>

                  ) : (

                    <div className="rounded-xl border border-slate-200 p-5 text-sm text-slate-500">
                      Audio is not available.
                    </div>

                  )}

                </section>


                {/* TRANSCRIPT CONTROLS */}

                <section>

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
                        onChange={(event) =>
                          setTranscriptSearch(
                            event.target.value
                          )
                        }
                        placeholder="Search transcript..."
                        className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
                      />

                    </div>


                    <select
                      value={
                        speakerFilter
                      }
                      onChange={(event) =>
                        setSpeakerFilter(
                          event.target.value
                        )
                      }
                      className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none"
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

                </section>


                {/* TRANSCRIPT */}

                <section>

                  {!transcriptSegments.length ? (

                    <div className="rounded-xl border border-slate-200 p-8 text-center">

                      <MessageSquareText
                        size={35}
                        className="mx-auto text-slate-400"
                      />

                      <p className="mt-3 text-sm text-slate-500">
                        Transcript is not available yet.
                      </p>

                    </div>

                  ) : (

                    <div className="max-h-[650px] space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">

                      {filteredTranscript.map(
                        (
                          segment
                        ) => {

                          const originalIndex =
                            transcriptSegments.indexOf(
                              segment
                            );

                          const isActive =
                            originalIndex ===
                            activeSegmentIndex;

                          return (

                            <div
                              key={`${segment.start}-${originalIndex}`}
                              ref={(element) => {
                                transcriptRefs.current[
                                  originalIndex
                                ] =
                                  element;
                              }}
                              className={`
                                rounded-lg
                                border
                                p-4
                                transition
                                ${
                                  isActive
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                                }
                              `}
                            >

                              <div className="flex items-start gap-3">

                                <button
                                  onClick={() =>
                                    jumpToTimestamp(
                                      segment.start
                                    )
                                  }
                                  className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 hover:bg-blue-100 hover:text-blue-700"
                                >
                                  {formatTimestamp(
                                    segment.start
                                  )}
                                </button>


                                <div className="min-w-0 flex-1">

                                  {segment.speaker && (

                                    <p className="mb-1 text-xs font-semibold text-blue-600">
                                      {segment.speaker}
                                    </p>

                                  )}

                                  <p className="text-sm leading-6 text-slate-700">
                                    {segment.text}
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

              </div>

            )}


            {/* ================================== */}
            {/* SPEAKERS */}
            {/* ================================== */}

            {activeTab ===
              "speakers" && (

              <div className="space-y-6">

                <div>

                  <h3 className="text-lg font-semibold text-slate-900">
                    Speaker Intelligence
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Participation and speaking patterns detected in the meeting.
                  </p>

                </div>


                {speakerAnalytics.length ===
                0 ? (

                  <div className="rounded-xl border border-slate-200 p-8 text-center">

                    <Users
                      size={36}
                      className="mx-auto text-slate-400"
                    />

                    <p className="mt-3 text-sm text-slate-500">
                      Speaker analytics are not available yet.
                    </p>

                  </div>

                ) : (

                  <div className="grid gap-4 md:grid-cols-2">

                    {speakerAnalytics.map(
                      (
                        speaker,
                        index
                      ) => (

                        <div
                          key={
                            speaker.id ||
                            index
                          }
                          className="rounded-xl border border-slate-200 p-5"
                        >

                          <div className="flex items-center justify-between">

                            <div className="flex items-center gap-3">

                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                                {String(
                                  speaker.speaker ||
                                    "S"
                                ).slice(0, 1)}
                              </div>

                              <div>

                                <p className="font-semibold text-slate-900">
                                  {speaker.speaker ||
                                    "Unknown Speaker"}
                                </p>

                                <p className="text-xs text-slate-500">
                                  Speaker{" "}
                                  {index + 1}
                                </p>

                              </div>

                            </div>

                          </div>


                          <div className="mt-5 grid grid-cols-2 gap-3">

                            <div className="rounded-lg bg-slate-50 p-3">

                              <p className="text-xs text-slate-500">
                                Speaking Time
                              </p>

                              <p className="mt-1 font-semibold text-slate-800">
                                {formatDuration(
                                  speaker.speaking_time
                                )}
                              </p>

                            </div>


                            <div className="rounded-lg bg-slate-50 p-3">

                              <p className="text-xs text-slate-500">
                                Words
                              </p>

                              <p className="mt-1 font-semibold text-slate-800">
                                {speaker.word_count ||
                                  0}
                              </p>

                            </div>

                          </div>

                        </div>

                      )
                    )}

                  </div>

                )}

              </div>

            )}


            {/* ================================== */}
            {/* ACTION ITEMS */}
            {/* ================================== */}

            {activeTab ===
              "actions" && (

              <div className="space-y-6">

                <div>

                  <h3 className="text-lg font-semibold text-slate-900">
                    Action Items
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Tasks identified from the meeting.
                  </p>

                </div>


                {/* ACTION STATS */}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                  <div className="rounded-xl border border-slate-200 p-4">

                    <p className="text-xs text-slate-500">
                      Total
                    </p>

                    <p className="mt-1 text-2xl font-bold">
                      {actionItems.length}
                    </p>

                  </div>


                  <div className="rounded-xl border border-slate-200 p-4">

                    <p className="text-xs text-slate-500">
                      Pending
                    </p>

                    <p className="mt-1 text-2xl font-bold text-yellow-600">
                      {pendingCount}
                    </p>

                  </div>


                  <div className="rounded-xl border border-slate-200 p-4">

                    <p className="text-xs text-slate-500">
                      In Progress
                    </p>

                    <p className="mt-1 text-2xl font-bold text-blue-600">
                      {inProgressCount}
                    </p>

                  </div>


                  <div className="rounded-xl border border-slate-200 p-4">

                    <p className="text-xs text-slate-500">
                      Completed
                    </p>

                    <p className="mt-1 text-2xl font-bold text-green-600">
                      {completedActionCount}
                    </p>

                  </div>

                </div>


                {/* FILTER */}

                <div className="flex flex-wrap gap-2">

                  {[
                    "all",
                    "pending",
                    "in_progress",
                    "completed",
                    "overdue"
                  ].map(
                    (filter) => (

                      <button
                        key={filter}
                        onClick={() =>
                          setActionFilter(
                            filter
                          )
                        }
                        className={`
                          rounded-lg
                          px-3
                          py-2
                          text-xs
                          font-medium
                          ${
                            actionFilter ===
                            filter
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }
                        `}
                      >

                        {filter ===
                        "in_progress"
                          ? "In Progress"
                          : filter
                              .charAt(0)
                              .toUpperCase() +
                            filter.slice(1)}

                        {filter ===
                          "overdue" &&
                          overdueCount >
                            0 && (
                            <span className="ml-1">
                              ({overdueCount})
                            </span>
                          )}

                      </button>

                    )
                  )}

                </div>


                {/* ITEMS */}

                {filteredActionItems.length ===
                0 ? (

                  <div className="rounded-xl border border-slate-200 p-8 text-center">

                    <CheckCircle
                      size={36}
                      className="mx-auto text-slate-400"
                    />

                    <p className="mt-3 text-sm text-slate-500">
                      No action items found.
                    </p>

                  </div>

                ) : (

                  <div className="space-y-3">

                    {filteredActionItems.map(
                      (item) => (

                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 p-5"
                        >

                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                            <div className="min-w-0 flex-1">

                              <div className="flex items-start gap-3">

                                <div
                                  className={`
                                    mt-1
                                    h-2.5
                                    w-2.5
                                    shrink-0
                                    rounded-full
                                    ${
                                      item.status ===
                                      "completed"
                                        ? "bg-green-500"
                                        : isOverdue(
                                            item
                                          )
                                        ? "bg-red-500"
                                        : "bg-blue-500"
                                    }
                                  `}
                                />

                                <div>

                                  <p className="font-medium leading-6 text-slate-900">
                                    {item.task}
                                  </p>

                                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">

                                    {item.assigned_to && (

                                      <span>
                                        Assigned to:{" "}
                                        <strong>
                                          {item.assigned_to}
                                        </strong>
                                      </span>

                                    )}

                                    {item.deadline && (

                                      <span>
                                        Deadline:{" "}
                                        {item.deadline}
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
                                disabled={
                                  updatingAction ===
                                  item.id
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateActionItem(
                                    item,
                                    {
                                      status:
                                        event
                                          .target
                                          .value
                                    }
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
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
                                disabled={
                                  updatingAction ===
                                  item.id
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateActionItem(
                                    item,
                                    {
                                      priority:
                                        event
                                          .target
                                          .value
                                    }
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
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


            {/* ================================== */}
            {/* AI INSIGHTS */}
            {/* ================================== */}

            {activeTab ===
              "ai" && (

              <div className="space-y-6">

                <div>

                  <h3 className="text-lg font-semibold text-slate-900">
                    AI Meeting Insights
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    AI-generated observations and recommendations based on this meeting.
                  </p>

                </div>


                {/* INSIGHTS */}

                <section>

                  <div className="mb-3 flex items-center gap-2">

                    <Sparkles
                      size={18}
                      className="text-blue-600"
                    />

                    <h4 className="font-semibold text-slate-900">
                      Insights
                    </h4>

                  </div>


                  {insights.length >
                  0 ? (

                    <div className="grid gap-4 md:grid-cols-2">

                      {insights.map(
                        (
                          insight,
                          index
                        ) => (

                          <div
                            key={index}
                            className="rounded-xl border border-slate-200 p-5"
                          >

                            <div className="flex gap-3">

                              <div className="rounded-lg bg-blue-50 p-2">

                                <Lightbulb
                                  size={18}
                                  className="text-blue-600"
                                />

                              </div>

                              <div>

                                <h5 className="font-semibold text-slate-900">
                                  {insight.title ||
                                    "Meeting Insight"}
                                </h5>

                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                  {insight.description ||
                                    insight.text ||
                                    ""}
                                </p>

                              </div>

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  ) : (

                    <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                      No AI insights available yet.
                    </div>

                  )}

                </section>


                {/* RECOMMENDATIONS */}

                <section>

                  <div className="mb-3 flex items-center gap-2">

                    <Target
                      size={18}
                      className="text-green-600"
                    />

                    <h4 className="font-semibold text-slate-900">
                      Recommendations
                    </h4>

                  </div>


                  {recommendations.length >
                  0 ? (

                    <div className="space-y-3">

                      {recommendations.map(
                        (
                          recommendation,
                          index
                        ) => (

                          <div
                            key={index}
                            className="flex gap-3 rounded-lg border border-slate-200 p-4"
                          >

                            <CheckCircle
                              size={18}
                              className="mt-0.5 shrink-0 text-green-600"
                            />

                            <p className="text-sm leading-6 text-slate-700">
                              {recommendation}
                            </p>

                          </div>

                        )
                      )}

                    </div>

                  ) : (

                    <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                      No recommendations available yet.
                    </div>

                  )}

                </section>

              </div>

            )}


            {/* ================================== */}
            {/* ANALYTICS */}
            {/* ================================== */}

            {activeTab ===
              "analytics" && (

              <div className="space-y-6">

                <div>

                  <h3 className="text-lg font-semibold text-slate-900">
                    Meeting Analytics
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Detailed performance and participation metrics.
                  </p>

                </div>


                {/* SENTIMENT */}

                <section>

                  <h4 className="font-semibold text-slate-900">
                    Sentiment Overview
                  </h4>


                  <div className="mt-4 grid gap-4 sm:grid-cols-3">

                    <div className="rounded-xl border border-green-200 bg-green-50 p-5">

                      <p className="text-sm text-green-700">
                        Positive
                      </p>

                      <p className="mt-2 text-3xl font-bold text-green-700">
                        {meeting.positive_sentiment ||
                          0}
                      </p>

                    </div>


                    <div className="rounded-xl border border-red-200 bg-red-50 p-5">

                      <p className="text-sm text-red-700">
                        Negative
                      </p>

                      <p className="mt-2 text-3xl font-bold text-red-700">
                        {meeting.negative_sentiment ||
                          0}
                      </p>

                    </div>


                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

                      <p className="text-sm text-slate-600">
                        Neutral
                      </p>

                      <p className="mt-2 text-3xl font-bold text-slate-700">
                        {meeting.neutral_sentiment ||
                          0}
                      </p>

                    </div>

                  </div>

                </section>


                {/* GENERAL METRICS */}

                <section>

                  <h4 className="font-semibold text-slate-900">
                    Meeting Metrics
                  </h4>


                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                    <div className="rounded-xl border border-slate-200 p-5">

                      <p className="text-sm text-slate-500">
                        Total Words
                      </p>

                      <p className="mt-2 text-2xl font-bold">
                        {meeting.total_words ||
                          0}
                      </p>

                    </div>


                    <div className="rounded-xl border border-slate-200 p-5">

                      <p className="text-sm text-slate-500">
                        Speakers
                      </p>

                      <p className="mt-2 text-2xl font-bold">
                        {meeting.speaker_count ||
                          0}
                      </p>

                    </div>


                    <div className="rounded-xl border border-slate-200 p-5">

                      <p className="text-sm text-slate-500">
                        Action Items
                      </p>

                      <p className="mt-2 text-2xl font-bold">
                        {actionItems.length}
                      </p>

                    </div>


                    <div className="rounded-xl border border-slate-200 p-5">

                      <p className="text-sm text-slate-500">
                        Score
                      </p>

                      <p className="mt-2 text-2xl font-bold text-blue-600">
                        {effectivenessScore ??
                          "-"}
                      </p>

                    </div>

                  </div>

                </section>


                {/* SCORE BREAKDOWN */}

                <section>

                  <h4 className="font-semibold text-slate-900">
                    Effectiveness Breakdown
                  </h4>


                  {scoreBreakdown ? (

                    <div className="mt-4 space-y-3">

                      {Object.entries(
                        scoreBreakdown
                      ).map(
                        ([
                          key,
                          value
                        ]) => (

                          <div
                            key={key}
                            className="rounded-lg border border-slate-200 p-4"
                          >

                            <div className="mb-2 flex justify-between">

                              <span className="text-sm capitalize text-slate-600">
                                {key.replaceAll(
                                  "_",
                                  " "
                                )}
                              </span>

                              <span className="text-sm font-semibold">
                                {value}
                              </span>

                            </div>

                            <div className="h-2 rounded-full bg-slate-100">

                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{
                                  width: `${Math.min(
                                    Number(
                                      value
                                    ) || 0,
                                    100
                                  )}%`
                                }}
                              />

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  ) : (

                    <div className="mt-4 rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                      Score breakdown is not available.
                    </div>

                  )}

                </section>

              </div>

            )}

          </div>

        </div>


        {/* ======================================== */}
        {/* PROCESSING ACTION */}
        {/* ======================================== */}

        {meeting.status !==
          "completed" &&
          !processing && (

          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>

                <h3 className="font-semibold text-blue-900">
                  Meeting processing
                </h3>

                <p className="mt-1 text-sm text-blue-700">
                  Start the AI processing pipeline to generate transcription, speaker identification, analytics and insights.
                </p>

              </div>


              <button
                onClick={processMeeting}
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >

                <Sparkles size={17} />

                Start AI Processing

              </button>

            </div>

          </div>

        )}

      </main>

    </div>
  );
}
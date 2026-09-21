import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  Download,
  Clock,
  Users,
  FileText,
  ListTodo,
  BarChart3,
  Brain,
  Lightbulb,
  MessageSquare,
  Volume2,
  Pause,
  ChevronDown,
  Filter,
  RefreshCw,
} from "lucide-react";

import api from "../services/api";
import ProcessingProgress from "../components/ProcessingProgress";


export default function MeetingDetails() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  // ============================================================
  // STATE
  // ============================================================

  const [meeting, setMeeting] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [speakerAnalytics, setSpeakerAnalytics] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [processing, setProcessing] = useState(false);

  // Transcript
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState("all");

  // Action items
  const [actionFilter, setActionFilter] = useState("all");

  // Audio
  const [audioUrl, setAudioUrl] = useState("");
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // PDF
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Refs
  const audioRef = useRef(null);
  const transcriptRefs = useRef([]);
  const lastActiveSegment = useRef(-1);


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadMeeting();
  }, [meetingId]);


  // ============================================================
  // LIVE PROCESSING STATUS POLLING
  // ============================================================

  useEffect(() => {
    if (!meetingId || !meeting) return;

    const processingStatuses = [
      "processing",
      "transcribing",
      "diarizing",
      "analyzing",
    ];

    const shouldPoll = processingStatuses.includes(
      meeting.status
    );

    if (!shouldPoll) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await api.get(
          `/meetings/${meetingId}`
        );

        setMeeting(response.data);

        // Once completed, refresh all meeting data.
        if (response.data.status === "completed") {
          await loadMeetingData();
        }

      } catch (err) {
        console.error(
          "Failed to refresh processing status:",
          err
        );
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [meetingId, meeting?.status]);


  // ============================================================
  // AUTO SCROLL ACTIVE TRANSCRIPT SEGMENT
  // ============================================================

  useEffect(() => {
    if (!transcript?.segments?.length) return;

    const activeIndex = transcript.segments.findIndex(
      (segment) =>
        audioCurrentTime >= segment.start &&
        audioCurrentTime < segment.end
    );

    if (
      activeIndex !== -1 &&
      activeIndex !== lastActiveSegment.current
    ) {
      lastActiveSegment.current = activeIndex;

      const element =
        transcriptRefs.current[activeIndex];

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [audioCurrentTime, transcript]);


  // ============================================================
  // LOAD MEETING
  // ============================================================

  const loadMeeting = async () => {
    setLoading(true);
    setError("");

    try {
      await loadMeetingData();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Failed to load meeting."
      );
    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // LOAD ALL MEETING DATA
  // ============================================================

  const loadMeetingData = async () => {
    const meetingResponse = await api.get(
      `/meetings/${meetingId}`
    );

    const meetingData = meetingResponse.data;

    setMeeting(meetingData);

    // ----------------------------------------------------------
    // Transcript
    // ----------------------------------------------------------

    try {
      const transcriptResponse = await api.get(
        `/meetings/${meetingId}/transcript`
      );

      setTranscript(transcriptResponse.data);
    } catch {
      setTranscript(null);
    }

    // ----------------------------------------------------------
    // Action Items
    // ----------------------------------------------------------

    try {
      const actionResponse = await api.get(
        `/meetings/${meetingId}/action-items`
      );

      setActionItems(actionResponse.data || []);
    } catch {
      setActionItems([]);
    }

    // ----------------------------------------------------------
    // Speaker Analytics
    // ----------------------------------------------------------

    try {
      const speakerResponse = await api.get(
        `/meetings/${meetingId}/speaker-analytics`
      );

      setSpeakerAnalytics(
        speakerResponse.data || []
      );
    } catch {
      setSpeakerAnalytics([]);
    }

    // ----------------------------------------------------------
    // Audio
    // ----------------------------------------------------------

    if (
      meetingData.status === "completed" ||
      meetingData.audio_path
    ) {
      loadAudio();
    }
  };


  // ============================================================
  // LOAD AUDIO
  // ============================================================

  const loadAudio = async () => {
    try {
      const response = await api.get(
        `/meetings/${meetingId}/audio`,
        {
          responseType: "blob",
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
        "Failed to load audio:",
        err
      );
    }
  };


  // ============================================================
  // CLEAN AUDIO URL
  // ============================================================

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);


  // ============================================================
  // FORMAT TIMESTAMP
  // ============================================================

  const formatTimestamp = (seconds) => {
    if (
      seconds === null ||
      seconds === undefined ||
      Number.isNaN(seconds)
    ) {
      return "00:00";
    }

    const totalSeconds = Math.floor(seconds);

    const minutes = Math.floor(
      totalSeconds / 60
    );

    const remainingSeconds =
      totalSeconds % 60;

    return `${String(minutes).padStart(
      2,
      "0"
    )}:${String(remainingSeconds).padStart(
      2,
      "0"
    )}`;
  };


  // ============================================================
  // AUDIO TIME UPDATE
  // ============================================================

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;

    setAudioCurrentTime(
      audioRef.current.currentTime
    );
  };


  // ============================================================
  // AUDIO LOADED
  // ============================================================

  const handleAudioLoaded = () => {
    if (!audioRef.current) return;

    setAudioDuration(
      audioRef.current.duration || 0
    );
  };


  // ============================================================
  // JUMP TO TRANSCRIPT TIMESTAMP
  // ============================================================

  const jumpToTimestamp = (seconds) => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = seconds;

    setAudioCurrentTime(seconds);

    audioRef.current.play().catch(() => {});
  };


  // ============================================================
  // MANUAL PROCESS
  // ============================================================

  const processMeeting = async () => {
    setProcessing(true);
    setError("");

    try {
      await api.post(
        `/meetings/${meetingId}/process`
      );

      const response = await api.get(
        `/meetings/${meetingId}`
      );

      setMeeting(response.data);

    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Failed to start processing."
      );
    } finally {
      setProcessing(false);
    }
  };


  // ============================================================
  // TRANSCRIBE MANUALLY
  // ============================================================

  const transcribeMeeting = async () => {
    setProcessing(true);
    setError("");

    try {
      await api.post(
        `/meetings/${meetingId}/transcribe`
      );

      await loadMeetingData();

    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Transcription failed."
      );
    } finally {
      setProcessing(false);
    }
  };


  // ============================================================
  // DIARIZE MANUALLY
  // ============================================================

  const diarizeMeeting = async () => {
    setProcessing(true);
    setError("");

    try {
      await api.post(
        `/meetings/${meetingId}/diarize`
      );

      await loadMeetingData();

    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Speaker identification failed."
      );
    } finally {
      setProcessing(false);
    }
  };


  // ============================================================
  // ANALYZE MANUALLY
  // ============================================================

  const analyzeMeeting = async () => {
    setProcessing(true);
    setError("");

    try {
      await api.post(
        `/meetings/${meetingId}/analyze`
      );

      await loadMeetingData();

    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "AI analysis failed."
      );
    } finally {
      setProcessing(false);
    }
  };


  // ============================================================
  // ACTION ITEM STATUS
  // ============================================================

  const updateActionStatus = async (
    actionId,
    status
  ) => {
    try {
      await api.patch(
        `/meetings/action-items/${actionId}`,
        {
          status,
        }
      );

      const response = await api.get(
        `/meetings/${meetingId}/action-items`
      );

      setActionItems(
        response.data || []
      );

    } catch (err) {
      console.error(
        "Failed to update action item:",
        err
      );
    }
  };


  // ============================================================
  // ACTION ITEM PRIORITY
  // ============================================================

  const updateActionPriority = async (
    actionId,
    priority
  ) => {
    try {
      await api.patch(
        `/meetings/action-items/${actionId}`,
        {
          priority,
        }
      );

      const response = await api.get(
        `/meetings/${meetingId}/action-items`
      );

      setActionItems(
        response.data || []
      );

    } catch (err) {
      console.error(
        "Failed to update priority:",
        err
      );
    }
  };


  // ============================================================
  // DOWNLOAD PDF REPORT
  // ============================================================

  const downloadReport = async () => {
    setDownloadingReport(true);

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
        "Failed to download report:",
        err
      );

      setError(
        "Failed to download meeting report."
      );
    } finally {
      setDownloadingReport(false);
    }
  };


  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  const getStatusLabel = (status) => {
    const labels = {
      uploaded: "Uploaded",
      audio_ready: "Ready",
      processing: "Processing",
      transcribing: "Transcribing",
      transcribed: "Transcribed",
      diarizing: "Identifying Speakers",
      analyzing: "AI Analysis",
      completed: "Completed",
      processing_failed: "Processing Failed",
      transcription_failed:
        "Transcription Failed",
      diarization_failed:
        "Speaker Identification Failed",
      analysis_failed:
        "Analysis Failed",
    };

    return (
      labels[status] ||
      status ||
      "Unknown"
    );
  };


  const getStatusClasses = (status) => {
    if (status === "completed") {
      return "bg-green-100 text-green-700";
    }

    if (
      [
        "processing",
        "transcribing",
        "diarizing",
        "analyzing",
      ].includes(status)
    ) {
      return "bg-blue-100 text-blue-700";
    }

    if (
      status?.includes("failed")
    ) {
      return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-700";
  };


  const isOverdue = (deadline) => {
    if (
      !deadline ||
      deadline === "Not mentioned"
    ) {
      return false;
    }

    const parsedDate =
      new Date(deadline);

    if (Number.isNaN(parsedDate.getTime())) {
      return false;
    }

    return (
      parsedDate < new Date()
    );
  };


  // ============================================================
  // TRANSCRIPT FILTERING
  // ============================================================

  const transcriptSegments =
    transcript?.segments || [];

  const speakers = [
    ...new Set(
      transcriptSegments
        .map(
          (segment) =>
            segment.speaker
        )
        .filter(Boolean)
    ),
  ];

  const filteredTranscript =
    transcriptSegments.filter(
      (segment) => {

        const matchesSearch =
          !transcriptSearch ||
          segment.text
            ?.toLowerCase()
            .includes(
              transcriptSearch.toLowerCase()
            ) ||
          segment.speaker
            ?.toLowerCase()
            .includes(
              transcriptSearch.toLowerCase()
            );

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


  // ============================================================
  // ACTION ITEM FILTERING
  // ============================================================

  const filteredActionItems =
    actionItems.filter(
      (item) => {

        if (
          actionFilter === "all"
        ) {
          return true;
        }

        if (
          actionFilter === "overdue"
        ) {
          return isOverdue(
            item.deadline
          );
        }

        return (
          item.status ===
          actionFilter
        );
      }
    );


  const completedActions =
    actionItems.filter(
      (item) =>
        item.status ===
        "completed"
    ).length;

  const pendingActions =
    actionItems.filter(
      (item) =>
        item.status ===
        "pending"
    ).length;

  const inProgressActions =
    actionItems.filter(
      (item) =>
        item.status ===
        "in_progress"
    ).length;

  const overdueActions =
    actionItems.filter(
      (item) =>
        isOverdue(item.deadline) &&
        item.status !== "completed"
    ).length;


  // ============================================================
  // SCORE HELPERS
  // ============================================================

  const getScoreLabel = (score) => {
    if (score === null || score === undefined) {
      return "Not available";
    }

    if (score >= 85) {
      return "Excellent";
    }

    if (score >= 70) {
      return "Good";
    }

    if (score >= 50) {
      return "Needs Improvement";
    }

    return "Poor";
  };


  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">

          <Loader2
            className="mx-auto mb-3 animate-spin"
            size={32}
          />

          <p className="text-gray-500">
            Loading meeting...
          </p>

        </div>
      </div>
    );
  }


  // ============================================================
  // ERROR / NOT FOUND
  // ============================================================

  if (!meeting) {
    return (
      <div className="min-h-screen p-8">

        <button
          onClick={() =>
            navigate("/dashboard")
          }
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error ||
            "Meeting not found."}
        </div>

      </div>
    );
  }


  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ======================================================
          HEADER
      ======================================================= */}

      <header className="border-b bg-white">

        <div className="mx-auto max-w-7xl px-6 py-5">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>

              <button
                onClick={() =>
                  navigate("/dashboard")
                }
                className="mb-3 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </button>

              <h1 className="text-2xl font-bold text-gray-900">
                {meeting.title ||
                  meeting.file_name ||
                  "Meeting"}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">

                <span className="flex items-center gap-1">
                  <FileText size={15} />
                  {meeting.file_name}
                </span>

                {meeting.duration && (
                  <span className="flex items-center gap-1">
                    <Clock size={15} />
                    {formatTimestamp(
                      meeting.duration
                    )}
                  </span>
                )}

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                    meeting.status
                  )}`}
                >
                  {getStatusLabel(
                    meeting.status
                  )}
                </span>

              </div>

            </div>


            <div className="flex items-center gap-2">

              <button
                onClick={loadMeeting}
                className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                <RefreshCw size={16} />
                Refresh
              </button>

              {meeting.status ===
                "completed" && (
                <button
                  onClick={downloadReport}
                  disabled={
                    downloadingReport
                  }
                  className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {downloadingReport ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Download
                      size={16}
                    />
                  )}

                  PDF Report
                </button>
              )}

            </div>

          </div>

        </div>

      </header>


      {/* ======================================================
          CONTENT
      ======================================================= */}

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">

        {/* ERROR */}

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">

            <AlertCircle size={20} />

            <span>{error}</span>

          </div>
        )}


        {/* ====================================================
            PROCESSING PROGRESS
        ===================================================== */}

        {[
          "processing",
          "transcribing",
          "diarizing",
          "analyzing",
          "processing_failed",
        ].includes(
          meeting.status
        ) && (
          <ProcessingProgress
            status={meeting.status}
          />
        )}


        {/* ====================================================
            MANUAL PROCESS BUTTON
        ===================================================== */}

        {[
          "audio_ready",
          "uploaded",
        ].includes(
          meeting.status
        ) && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">

            <div className="flex flex-wrap items-center justify-between gap-4">

              <div>

                <h2 className="text-lg font-semibold">
                  Process Meeting
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Run transcription, speaker
                  identification and AI analysis.
                </p>

              </div>

              <button
                onClick={processMeeting}
                disabled={processing}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >

                {processing ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Play size={18} />
                )}

                Start Processing

              </button>

            </div>

          </div>
        )}


        {/* ====================================================
            AUDIO PLAYER
        ===================================================== */}

        {audioUrl && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">

            <div className="mb-4 flex items-center gap-3">

              <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                <Volume2 size={20} />
              </div>

              <div>

                <h2 className="font-semibold">
                  Meeting Audio
                </h2>

                <p className="text-sm text-gray-500">
                  Play audio and follow the synchronized transcript.
                </p>

              </div>

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

            <div className="mt-2 flex justify-between text-xs text-gray-500">
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

          </section>
        )}


        {/* ====================================================
            KPI CARDS
        ===================================================== */}

        {meeting.status ===
          "completed" && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-xl border bg-white p-5 shadow-sm">

              <div className="mb-3 flex items-center justify-between">

                <span className="text-sm text-gray-500">
                  Total Words
                </span>

                <FileText
                  size={20}
                  className="text-blue-600"
                />

              </div>

              <p className="text-2xl font-bold">
                {meeting.total_words ??
                  0}
              </p>

            </div>


            <div className="rounded-xl border bg-white p-5 shadow-sm">

              <div className="mb-3 flex items-center justify-between">

                <span className="text-sm text-gray-500">
                  Speakers
                </span>

                <Users
                  size={20}
                  className="text-purple-600"
                />

              </div>

              <p className="text-2xl font-bold">
                {meeting.speaker_count ??
                  speakers.length}
              </p>

            </div>


            <div className="rounded-xl border bg-white p-5 shadow-sm">

              <div className="mb-3 flex items-center justify-between">

                <span className="text-sm text-gray-500">
                  Action Items
                </span>

                <ListTodo
                  size={20}
                  className="text-orange-600"
                />

              </div>

              <p className="text-2xl font-bold">
                {actionItems.length}
              </p>

            </div>


            <div className="rounded-xl border bg-white p-5 shadow-sm">

              <div className="mb-3 flex items-center justify-between">

                <span className="text-sm text-gray-500">
                  Effectiveness
                </span>

                <BarChart3
                  size={20}
                  className="text-green-600"
                />

              </div>

              <p className="text-2xl font-bold">
                {meeting.effectiveness_score ??
                  "—"}
                {meeting.effectiveness_score !==
                  null &&
                  meeting.effectiveness_score !==
                    undefined &&
                  "%"}
              </p>

              <p className="text-xs text-gray-500">
                {meeting.effectiveness_rating ||
                  getScoreLabel(
                    meeting.effectiveness_score
                  )}
              </p>

            </div>

          </section>
        )}


        {/* ====================================================
            MEETING INTELLIGENCE
        ===================================================== */}

        {meeting.status ===
          "completed" && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">

            <div className="mb-6 flex items-center gap-3">

              <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
                <Brain size={20} />
              </div>

              <div>

                <h2 className="text-lg font-semibold">
                  Meeting Intelligence
                </h2>

                <p className="text-sm text-gray-500">
                  AI-generated understanding of the meeting.
                </p>

              </div>

            </div>


            {/* SUMMARY */}

            <div className="mb-6">

              <h3 className="mb-2 font-semibold">
                Executive Summary
              </h3>

              <p className="leading-7 text-gray-700">
                {meeting.summary ||
                  "No summary available."}
              </p>

            </div>


            <div className="grid gap-6 md:grid-cols-2">

              {/* KEY POINTS */}

              <div>

                <h3 className="mb-3 font-semibold">
                  Key Points
                </h3>

                {meeting.key_points ? (
                  <ul className="space-y-2">

                    {(() => {
                      try {
                        const points =
                          typeof meeting.key_points ===
                          "string"
                            ? JSON.parse(
                                meeting.key_points
                              )
                            : meeting.key_points;

                        return points.map(
                          (point, index) => (
                            <li
                              key={index}
                              className="flex gap-2 text-sm text-gray-700"
                            >
                              <span className="mt-1 text-blue-600">
                                •
                              </span>

                              <span>
                                {point}
                              </span>
                            </li>
                          )
                        );

                      } catch {
                        return (
                          <p className="text-sm text-gray-600">
                            {meeting.key_points}
                          </p>
                        );
                      }
                    })()}

                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">
                    No key points available.
                  </p>
                )}

              </div>


              {/* DECISIONS */}

              <div>

                <h3 className="mb-3 font-semibold">
                  Decisions
                </h3>

                {meeting.decisions ? (
                  <ul className="space-y-2">

                    {(() => {
                      try {
                        const decisions =
                          typeof meeting.decisions ===
                          "string"
                            ? JSON.parse(
                                meeting.decisions
                              )
                            : meeting.decisions;

                        return decisions.map(
                          (decision, index) => (
                            <li
                              key={index}
                              className="flex gap-2 text-sm text-gray-700"
                            >
                              <CheckCircle
                                size={16}
                                className="mt-0.5 shrink-0 text-green-600"
                              />

                              <span>
                                {decision}
                              </span>
                            </li>
                          )
                        );

                      } catch {
                        return (
                          <p className="text-sm text-gray-600">
                            {meeting.decisions}
                          </p>
                        );
                      }
                    })()}

                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">
                    No decisions available.
                  </p>
                )}

              </div>

            </div>

          </section>
        )}


        {/* ====================================================
            AI INSIGHTS + RECOMMENDATIONS
        ===================================================== */}

        {meeting.status ===
          "completed" && (
          <section className="grid gap-6 lg:grid-cols-2">

            {/* INSIGHTS */}

            <div className="rounded-xl border bg-white p-6 shadow-sm">

              <div className="mb-5 flex items-center gap-3">

                <div className="rounded-lg bg-yellow-100 p-2 text-yellow-600">
                  <Lightbulb size={20} />
                </div>

                <div>

                  <h2 className="font-semibold">
                    AI Insights
                  </h2>

                  <p className="text-sm text-gray-500">
                    Important observations from the meeting.
                  </p>

                </div>

              </div>

              <div className="space-y-4">

                {(() => {
                  try {
                    const insights =
                      typeof meeting.meeting_insights ===
                      "string"
                        ? JSON.parse(
                            meeting.meeting_insights
                          )
                        : meeting.meeting_insights;

                    if (!insights?.length) {
                      return (
                        <p className="text-sm text-gray-500">
                          No insights available.
                        </p>
                      );
                    }

                    return insights.map(
                      (insight, index) => (
                        <div
                          key={index}
                          className="rounded-lg border bg-gray-50 p-4"
                        >

                          <div className="mb-1 flex items-center gap-2">

                            <span className="font-medium">
                              {insight.title}
                            </span>

                            {insight.type && (
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500">
                                {insight.type}
                              </span>
                            )}

                          </div>

                          <p className="text-sm leading-6 text-gray-600">
                            {insight.description}
                          </p>

                        </div>
                      )
                    );

                  } catch {
                    return (
                      <p className="text-sm text-gray-600">
                        {meeting.meeting_insights}
                      </p>
                    );
                  }
                })()}

              </div>

            </div>


            {/* RECOMMENDATIONS */}

            <div className="rounded-xl border bg-white p-6 shadow-sm">

              <div className="mb-5 flex items-center gap-3">

                <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                  <Brain size={20} />
                </div>

                <div>

                  <h2 className="font-semibold">
                    AI Recommendations
                  </h2>

                  <p className="text-sm text-gray-500">
                    Suggestions based on meeting data.
                  </p>

                </div>

              </div>

              <div className="space-y-3">

                {(() => {
                  try {
                    const recommendations =
                      typeof meeting.meeting_recommendations ===
                      "string"
                        ? JSON.parse(
                            meeting.meeting_recommendations
                          )
                        : meeting.meeting_recommendations;

                    if (
                      !recommendations?.length
                    ) {
                      return (
                        <p className="text-sm text-gray-500">
                          No recommendations available.
                        </p>
                      );
                    }

                    return recommendations.map(
                      (
                        recommendation,
                        index
                      ) => (
                        <div
                          key={index}
                          className="flex gap-3 rounded-lg border bg-gray-50 p-4"
                        >

                          <CheckCircle
                            size={18}
                            className="mt-0.5 shrink-0 text-blue-600"
                          />

                          <p className="text-sm leading-6 text-gray-700">
                            {recommendation}
                          </p>

                        </div>
                      )
                    );

                  } catch {
                    return (
                      <p className="text-sm text-gray-600">
                        {meeting.meeting_recommendations}
                      </p>
                    );
                  }
                })()}

              </div>

            </div>

          </section>
        )}


        {/* ====================================================
            EFFECTIVENESS SCORE
        ===================================================== */}

        {meeting.status ===
          "completed" &&
          meeting.effectiveness_score !==
            null &&
          meeting.effectiveness_score !==
            undefined && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">

            <div className="mb-6 flex items-center gap-3">

              <div className="rounded-lg bg-green-100 p-2 text-green-600">
                <BarChart3 size={20} />
              </div>

              <div>

                <h2 className="text-lg font-semibold">
                  Meeting Effectiveness
                </h2>

                <p className="text-sm text-gray-500">
                  Overall meeting quality based on available metrics.
                </p>

              </div>

            </div>


            <div className="grid gap-6 md:grid-cols-3">

              <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 p-6">

                <div className="text-5xl font-bold text-gray-900">
                  {meeting.effectiveness_score}
                </div>

                <div className="mt-2 text-sm text-gray-500">
                  out of 100
                </div>

                <div className="mt-3 rounded-full bg-green-100 px-4 py-1 text-sm font-medium text-green-700">
                  {meeting.effectiveness_rating ||
                    getScoreLabel(
                      meeting.effectiveness_score
                    )}
                </div>

              </div>


              <div className="md:col-span-2">

                {(() => {

                  let breakdown = null;

                  try {

                    if (
                      meeting.effectiveness_breakdown
                    ) {
                      breakdown =
                        typeof meeting.effectiveness_breakdown ===
                        "string"
                          ? JSON.parse(
                              meeting.effectiveness_breakdown
                            )
                          : meeting.effectiveness_breakdown;
                    }

                  } catch {
                    breakdown = null;
                  }

                  if (!breakdown) {
                    return (
                      <div className="rounded-xl bg-gray-50 p-6">
                        <p className="text-sm text-gray-500">
                          Detailed score breakdown is not available.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 gap-4">

                      {Object.entries(
                        breakdown
                      ).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="rounded-xl border p-4"
                          >

                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              {key.replace(
                                /_/g,
                                " "
                              )}
                            </p>

                            <p className="mt-2 text-2xl font-bold">
                              {value}
                            </p>

                          </div>
                        )
                      )}

                    </div>
                  );

                })()}

              </div>

            </div>

          </section>
        )}


        {/* ====================================================
            SENTIMENT
        ===================================================== */}

        {meeting.status ===
          "completed" && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">

            <div className="mb-5 flex items-center gap-3">

              <div className="rounded-lg bg-pink-100 p-2 text-pink-600">
                <MessageSquare size={20} />
              </div>

              <div>

                <h2 className="font-semibold">
                  Sentiment Overview
                </h2>

                <p className="text-sm text-gray-500">
                  Overall sentiment detected across the transcript.
                </p>

              </div>

            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              <div className="rounded-xl border bg-green-50 p-5">

                <p className="text-sm text-green-700">
                  Positive
                </p>

                <p className="mt-2 text-3xl font-bold text-green-800">
                  {meeting.positive_sentiment ??
                    0}
                </p>

              </div>

              <div className="rounded-xl border bg-red-50 p-5">

                <p className="text-sm text-red-700">
                  Negative
                </p>

                <p className="mt-2 text-3xl font-bold text-red-800">
                  {meeting.negative_sentiment ??
                    0}
                </p>

              </div>

              <div className="rounded-xl border bg-gray-50 p-5">

                <p className="text-sm text-gray-700">
                  Neutral
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-800">
                  {meeting.neutral_sentiment ??
                    0}
                </p>

              </div>

            </div>

          </section>
        )}


        {/* ====================================================
            SPEAKER INTELLIGENCE
        ===================================================== */}

        {meeting.status ===
          "completed" &&
          speakerAnalytics.length >
            0 && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">

            <div className="mb-5 flex items-center gap-3">

              <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
                <Users size={20} />
              </div>

              <div>

                <h2 className="font-semibold">
                  Speaker Intelligence
                </h2>

                <p className="text-sm text-gray-500">
                  Participation and speaking distribution.
                </p>

              </div>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-left text-sm">

                <thead>

                  <tr className="border-b text-gray-500">

                    <th className="px-4 py-3">
                      Speaker
                    </th>

                    <th className="px-4 py-3">
                      Speaking Time
                    </th>

                    <th className="px-4 py-3">
                      Words
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {speakerAnalytics.map(
                    (speaker, index) => (
                      <tr
                        key={speaker.id || index}
                        className="border-b last:border-0"
                      >

                        <td className="px-4 py-3 font-medium">
                          {speaker.speaker}
                        </td>

                        <td className="px-4 py-3">
                          {formatTimestamp(
                            speaker.speaking_time
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {speaker.word_count}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

          </section>
        )}


        {/* ====================================================
            ACTION ITEMS
        ===================================================== */}

        {meeting.status ===
          "completed" && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">

            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">

              <div className="flex items-center gap-3">

                <div className="rounded-lg bg-orange-100 p-2 text-orange-600">
                  <ListTodo size={20} />
                </div>

                <div>

                  <h2 className="font-semibold">
                    Action Items
                  </h2>

                  <p className="text-sm text-gray-500">
                    Tasks identified from the meeting.
                  </p>

                </div>

              </div>


              <div className="flex items-center gap-2">

                <Filter
                  size={16}
                  className="text-gray-500"
                />

                <select
                  value={actionFilter}
                  onChange={(e) =>
                    setActionFilter(
                      e.target.value
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                >

                  <option value="all">
                    All
                  </option>

                  <option value="pending">
                    Pending
                  </option>

                  <option value="in_progress">
                    In Progress
                  </option>

                  <option value="completed">
                    Completed
                  </option>

                  <option value="overdue">
                    Overdue
                  </option>

                </select>

              </div>

            </div>


            {/* ACTION STATS */}

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">

              <div className="rounded-lg bg-gray-50 p-4">

                <p className="text-xs text-gray-500">
                  Total
                </p>

                <p className="mt-1 text-xl font-bold">
                  {actionItems.length}
                </p>

              </div>

              <div className="rounded-lg bg-yellow-50 p-4">

                <p className="text-xs text-yellow-700">
                  Pending
                </p>

                <p className="mt-1 text-xl font-bold text-yellow-800">
                  {pendingActions}
                </p>

              </div>

              <div className="rounded-lg bg-blue-50 p-4">

                <p className="text-xs text-blue-700">
                  In Progress
                </p>

                <p className="mt-1 text-xl font-bold text-blue-800">
                  {inProgressActions}
                </p>

              </div>

              <div className="rounded-lg bg-green-50 p-4">

                <p className="text-xs text-green-700">
                  Completed
                </p>

                <p className="mt-1 text-xl font-bold text-green-800">
                  {completedActions}
                </p>

              </div>

            </div>


            {overdueActions > 0 && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {overdueActions} action item
                {overdueActions > 1
                  ? "s"
                  : ""}{" "}
                overdue.
              </div>
            )}


            {filteredActionItems.length ===
            0 ? (
              <div className="rounded-xl bg-gray-50 p-8 text-center">

                <ListTodo
                  size={32}
                  className="mx-auto mb-3 text-gray-400"
                />

                <p className="text-gray-500">
                  No action items found.
                </p>

              </div>
            ) : (
              <div className="space-y-3">

                {filteredActionItems.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border p-4"
                    >

                      <div className="flex flex-wrap items-start justify-between gap-4">

                        <div className="flex-1">

                          <p className="font-medium text-gray-900">
                            {item.task}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs">

                            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                              Assigned:{" "}
                              {item.assigned_to ||
                                "Unknown"}
                            </span>

                            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                              Deadline:{" "}
                              {item.deadline ||
                                "Not mentioned"}
                            </span>

                            <span
                              className={`rounded-full px-2 py-1 ${
                                item.priority ===
                                "high"
                                  ? "bg-red-100 text-red-700"
                                  : item.priority ===
                                    "low"
                                  ? "bg-gray-100 text-gray-600"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {item.priority ||
                                "medium"}
                            </span>

                            {isOverdue(
                              item.deadline
                            ) &&
                              item.status !==
                                "completed" && (
                                <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">
                                  Overdue
                                </span>
                              )}

                          </div>

                        </div>


                        <div className="flex flex-wrap gap-2">

                          <select
                            value={
                              item.status ||
                              "pending"
                            }
                            onChange={(e) =>
                              updateActionStatus(
                                item.id,
                                e.target.value
                              )
                            }
                            className="rounded-lg border px-2 py-1.5 text-xs"
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
                            onChange={(e) =>
                              updateActionPriority(
                                item.id,
                                e.target.value
                              )
                            }
                            className="rounded-lg border px-2 py-1.5 text-xs"
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

          </section>
        )}


        {/* ====================================================
            TRANSCRIPT
        ===================================================== */}

        {transcript && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">

            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">

              <div className="flex items-center gap-3">

                <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                  <FileText size={20} />
                </div>

                <div>

                  <h2 className="font-semibold">
                    Transcript
                  </h2>

                  <p className="text-sm text-gray-500">
                    {transcript.language
                      ? `Language: ${transcript.language}`
                      : "Meeting transcript"}
                  </p>

                </div>

              </div>

            </div>


            {/* SEARCH + SPEAKER FILTER */}

            <div className="mb-5 flex flex-col gap-3 md:flex-row">

              <div className="relative flex-1">

                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={
                    transcriptSearch
                  }
                  onChange={(e) =>
                    setTranscriptSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search transcript..."
                  className="w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
                />

              </div>


              <div className="relative">

                <select
                  value={
                    speakerFilter
                  }
                  onChange={(e) =>
                    setSpeakerFilter(
                      e.target.value
                    )
                  }
                  className="w-full appearance-none rounded-lg border bg-white px-4 py-2.5 pr-9 text-sm md:w-52"
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

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

              </div>

            </div>


            {/* TRANSCRIPT */}

            {filteredTranscript.length ===
            0 ? (
              <div className="rounded-xl bg-gray-50 p-8 text-center">

                <Search
                  size={32}
                  className="mx-auto mb-3 text-gray-400"
                />

                <p className="text-gray-500">
                  No transcript segments match your search.
                </p>

              </div>
            ) : (
              <div className="max-h-[650px] space-y-2 overflow-y-auto pr-2">

                {filteredTranscript.map(
                  (segment, index) => {

                    const originalIndex =
                      transcriptSegments.indexOf(
                        segment
                      );

                    const isActive =
                      audioCurrentTime >=
                        segment.start &&
                      audioCurrentTime <
                        segment.end;

                    return (
                      <div
                        key={`${segment.start}-${index}`}
                        ref={(element) => {
                          transcriptRefs.current[
                            originalIndex
                          ] = element;
                        }}
                        className={`rounded-xl border p-4 transition ${
                          isActive
                            ? "border-blue-300 bg-blue-50 shadow-sm"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >

                        <div className="flex gap-4">

                          <button
                            onClick={() =>
                              jumpToTimestamp(
                                segment.start
                              )
                            }
                            className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-blue-100 hover:text-blue-700"
                          >
                            {formatTimestamp(
                              segment.start
                            )}
                          </button>


                          <div className="min-w-0 flex-1">

                            <div className="mb-1 flex flex-wrap items-center gap-2">

                              {segment.speaker && (
                                <span className="font-semibold text-gray-900">
                                  {segment.speaker}
                                </span>
                              )}

                              {isActive && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                  Playing
                                </span>
                              )}

                            </div>

                            <p className="leading-7 text-gray-700">
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
        )}

      </main>

    </div>
  );
}


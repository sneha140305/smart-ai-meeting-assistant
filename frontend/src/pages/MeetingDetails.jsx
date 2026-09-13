import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  FileAudio,
  LoaderCircle,
  Play,
  Brain,
  Users,
  AlertCircle,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

export default function MeetingDetails() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [transcript, setTranscript] = useState(null);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------
  // FETCH MEETING
  // --------------------------------

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/meetings/${meetingId}`
      );

      setMeeting(response.data);

      if (
        response.data.status === "transcribed" ||
        response.data.status === "completed"
      ) {
        await fetchTranscript();
      }
    } catch (err) {
      console.error("Meeting fetch error:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to load meeting."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------
  // FETCH TRANSCRIPT
  // --------------------------------

  const fetchTranscript = async () => {
    try {
      const response = await api.get(
        `/meetings/${meetingId}/transcript`
      );

      setTranscript(response.data);
    } catch (err) {
      console.log("Transcript not available yet.");
    }
  };

  useEffect(() => {
    fetchMeeting();
  }, [meetingId]);

  // --------------------------------
  // TRANSCRIBE
  // --------------------------------

  const handleTranscribe = async () => {
    try {
      setProcessing(true);
      setError("");

      setMeeting((prev) => ({
        ...prev,
        status: "transcribing",
      }));

      await api.post(
        `/meetings/${meetingId}/transcribe`
      );

      await fetchMeeting();
    } catch (err) {
      console.error("Transcription error:", err);

      setError(
        err.response?.data?.detail ||
          "Transcription failed."
      );

      await fetchMeeting();
    } finally {
      setProcessing(false);
    }
  };

  // --------------------------------
  // DIARIZATION
  // --------------------------------

  const handleDiarization = async () => {
    try {
      setProcessing(true);
      setError("");

      setMeeting((prev) => ({
        ...prev,
        status: "diarizing",
      }));

      await api.post(
        `/meetings/${meetingId}/diarize`
      );

      await fetchMeeting();
    } catch (err) {
      console.error("Diarization error:", err);

      setError(
        err.response?.data?.detail ||
          "Speaker identification failed."
      );

      await fetchMeeting();
    } finally {
      setProcessing(false);
    }
  };

  // --------------------------------
  // ANALYZE
  // --------------------------------

  const handleAnalyze = async () => {
    try {
      setProcessing(true);
      setError("");

      setMeeting((prev) => ({
        ...prev,
        status: "analyzing",
      }));

      await api.post(
        `/meetings/${meetingId}/analyze`
      );

      await fetchMeeting();
    } catch (err) {
      console.error("Analysis error:", err);

      setError(
        err.response?.data?.detail ||
          "AI analysis failed."
      );

      await fetchMeeting();
    } finally {
      setProcessing(false);
    }
  };

  // --------------------------------
  // STATUS
  // --------------------------------

  const formatStatus = (status) => {
    if (!status) return "Unknown";

    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const getStatusStyle = (status) => {
    const normalized = status?.toLowerCase();

    if (normalized === "completed") {
      return "bg-green-100 text-green-700";
    }

    if (
      normalized === "audio_ready" ||
      normalized === "transcribed" ||
      normalized === "transcribing" ||
      normalized === "diarizing" ||
      normalized === "analyzing"
    ) {
      return "bg-yellow-100 text-yellow-700";
    }

    if (
      normalized?.includes("failed")
    ) {
      return "bg-red-100 text-red-700";
    }

    return "bg-slate-100 text-slate-600";
  };

  // --------------------------------
  // LOADING
  // --------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">

        <div className="text-center">

          <LoaderCircle
            size={40}
            className="animate-spin text-slate-500 mx-auto"
          />

          <p className="mt-4 text-slate-500">
            Loading meeting...
          </p>

        </div>

      </div>
    );
  }

  // --------------------------------
  // NOT FOUND
  // --------------------------------

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">

        <div className="text-center">

          <AlertCircle
            size={45}
            className="mx-auto text-red-500"
          />

          <h2 className="mt-4 text-xl font-bold text-slate-900">
            Meeting not found
          </h2>

          <p className="mt-2 text-slate-500">
            {error || "Unable to find this meeting."}
          </p>

          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 bg-slate-900 text-white px-5 py-3 rounded-lg"
          >
            Back to Dashboard
          </button>

        </div>

      </div>
    );
  }

  const hasTranscript =
    transcript &&
    Array.isArray(transcript.segments) &&
    transcript.segments.length > 0;

  const isTranscribed =
    meeting.status === "transcribed" ||
    meeting.status === "completed";

  const isDiarizing =
    meeting.status === "diarizing";

  return (
    <div className="min-h-screen bg-slate-50">

      {/* -------------------------------- */}
      {/* NAVBAR */}
      {/* -------------------------------- */}

      <header className="border-b bg-white">

        <div className="mx-auto max-w-7xl px-6 py-4">

          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>

        </div>

      </header>

      {/* -------------------------------- */}
      {/* MAIN */}
      {/* -------------------------------- */}

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* TITLE */}

        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

          <div className="flex items-start gap-4">

            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <FileAudio
                size={30}
                className="text-slate-700"
              />
            </div>

            <div>

              <h1 className="text-3xl font-bold text-slate-900">
                {meeting.title ||
                  `Meeting #${meeting.id}`}
              </h1>

              <p className="mt-1 text-slate-500">
                {meeting.file_name}
              </p>

            </div>

          </div>

          <span
            className={`w-fit rounded-full px-4 py-2 text-sm font-medium ${getStatusStyle(
              meeting.status
            )}`}
          >
            {formatStatus(meeting.status)}
          </span>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">

            <AlertCircle size={20} />

            <span>{error}</span>

          </div>
        )}

        {/* -------------------------------- */}
        {/* PROCESSING PIPELINE */}
        {/* -------------------------------- */}

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <h2 className="text-lg font-semibold text-slate-900">
            AI Processing Pipeline
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Convert your recording into an intelligent meeting report.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            {/* TRANSCRIPTION */}

            <div className="rounded-xl border border-slate-200 p-5">

              <div className="flex items-center gap-3">

                <div className="rounded-lg bg-slate-100 p-3">
                  <FileAudio size={22} />
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900">
                    1. Transcription
                  </h3>

                  <p className="text-sm text-slate-500">
                    Convert speech to text.
                  </p>
                </div>

              </div>

              <button
                onClick={handleTranscribe}
                disabled={
                  processing ||
                  meeting.status !== "audio_ready"
                }
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >

                {processing &&
                meeting.status === "transcribing" ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Transcribing...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    Transcribe
                  </>
                )}

              </button>

            </div>

            {/* SPEAKER DIARIZATION */}

            <div className="rounded-xl border border-slate-200 p-5">

              <div className="flex items-center gap-3">

                <div className="rounded-lg bg-slate-100 p-3">
                  <Users size={22} />
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900">
                    2. Speakers
                  </h3>

                  <p className="text-sm text-slate-500">
                    Identify who spoke when.
                  </p>
                </div>

              </div>

              <button
                onClick={handleDiarization}
                disabled={
                  processing ||
                  !isTranscribed ||
                  isDiarizing
                }
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
              >

                {processing && isDiarizing ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Identifying...
                  </>
                ) : (
                  <>
                    <Users size={18} />
                    Identify Speakers
                  </>
                )}

              </button>

            </div>

            {/* AI ANALYSIS */}

            <div className="rounded-xl border border-slate-200 p-5">

              <div className="flex items-center gap-3">

                <div className="rounded-lg bg-slate-100 p-3">
                  <Brain size={22} />
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900">
                    3. AI Analysis
                  </h3>

                  <p className="text-sm text-slate-500">
                    Generate meeting intelligence.
                  </p>
                </div>

              </div>

              <button
                onClick={handleAnalyze}
                disabled={
                  processing ||
                  !hasTranscript ||
                  !isTranscribed
                }
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >

                {processing &&
                meeting.status === "analyzing" ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain size={18} />
                    Analyze
                  </>
                )}

              </button>

            </div>

          </div>

        </div>

        {/* -------------------------------- */}
        {/* SPEAKER TRANSCRIPT */}
        {/* -------------------------------- */}

        {hasTranscript && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b px-6 py-5">

              <div className="flex items-center gap-3">

                <CheckCircle
                  size={22}
                  className="text-green-600"
                />

                <div>

                  <h2 className="text-lg font-semibold text-slate-900">
                    Meeting Transcript
                  </h2>

                  <p className="text-sm text-slate-500">
                    Language:{" "}
                    {transcript.language || "Unknown"}
                  </p>

                </div>

              </div>

            </div>

            <div className="max-h-[600px] overflow-y-auto p-6">

              <div className="space-y-5">

                {transcript.segments.map(
                  (segment, index) => (

                    <div
                      key={index}
                      className="flex gap-4"
                    >

                      {/* SPEAKER */}

                      <div className="w-32 shrink-0">

                        <span className="inline-flex rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                          {segment.speaker ||
                            "UNKNOWN"}
                        </span>

                      </div>

                      {/* TEXT */}

                      <div className="flex-1">

                        <p className="text-sm leading-7 text-slate-700">
                          {segment.text}
                        </p>

                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">

                          <Clock size={12} />

                          {segment.start}s –{" "}
                          {segment.end}s

                        </div>

                      </div>

                    </div>

                  )
                )}

              </div>

            </div>

          </div>
        )}

      </main>

    </div>
  );
}



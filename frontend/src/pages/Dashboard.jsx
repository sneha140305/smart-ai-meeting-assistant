import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  FileAudio,
  LogOut,
  Plus,
  RefreshCw,
  CheckCircle,
  LoaderCircle,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --------------------------------
  // FETCH MEETINGS
  // --------------------------------

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/meetings/");

      console.log("Meetings:", response.data);

      if (Array.isArray(response.data)) {
        setMeetings(response.data);
      } else {
        setMeetings([]);
      }
    } catch (err) {
      console.error("Fetch meetings error:", err);

      if (err.response?.status === 401) {
        logout();
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to load meetings."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------
  // LOAD MEETINGS ON PAGE LOAD
  // --------------------------------

  useEffect(() => {
    fetchMeetings();
  }, []);

  // --------------------------------
  // STATISTICS
  // --------------------------------

  const completedMeetings = meetings.filter(
    (meeting) =>
      meeting.status?.toLowerCase() === "completed"
  ).length;

  const processingMeetings = meetings.filter(
    (meeting) =>
      [
        "processing",
        "preprocessing",
        "audio_ready",
        "transcribing",
        "analyzing",
      ].includes(meeting.status?.toLowerCase())
  ).length;

  // --------------------------------
  // DATE FORMAT
  // --------------------------------

  const formatDate = (dateString) => {
    if (!dateString) {
      return "Date unavailable";
    }

    try {
      return new Date(dateString).toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    } catch {
      return "Date unavailable";
    }
  };

  // --------------------------------
  // STATUS STYLE
  // --------------------------------

  const getStatusStyle = (status) => {
    const normalized = status?.toLowerCase();

    if (normalized === "completed") {
      return "bg-green-100 text-green-700";
    }

    if (
      normalized === "processing" ||
      normalized === "preprocessing" ||
      normalized === "audio_ready" ||
      normalized === "transcribing" ||
      normalized === "analyzing"
    ) {
      return "bg-yellow-100 text-yellow-700";
    }

    if (
      normalized === "failed" ||
      normalized === "processing_failed" ||
      normalized === "transcription_failed" ||
      normalized === "analysis_failed"
    ) {
      return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-600";
  };

  // --------------------------------
  // FORMAT STATUS TEXT
  // --------------------------------

  const formatStatus = (status) => {
    if (!status) {
      return "Unknown";
    }

    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  // --------------------------------
  // LOGOUT
  // --------------------------------

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // --------------------------------
  // OPEN MEETING
  // --------------------------------

  const openMeeting = (meetingId) => {
    navigate(`/meetings/${meetingId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* -------------------------------- */}
      {/* NAVBAR */}
      {/* -------------------------------- */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Smart AI Meeting Assistant
            </h1>

            <p className="text-sm text-slate-500">
              Your intelligent meeting workspace
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <LogOut size={17} />
            Logout
          </button>

        </div>
      </header>

      {/* -------------------------------- */}
      {/* MAIN */}
      {/* -------------------------------- */}

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* -------------------------------- */}
        {/* HEADER */}
        {/* -------------------------------- */}

        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">

          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              Dashboard
            </h2>

            <p className="mt-1 text-slate-500">
              Manage and analyze your meetings with AI.
            </p>
          </div>

          {/* NEW MEETING BUTTON */}

          <button
            onClick={() => navigate("/new-meeting")}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700 transition"
          >
            <Plus size={18} />
            New Meeting
          </button>

        </div>

        {/* -------------------------------- */}
        {/* ERROR */}
        {/* -------------------------------- */}

        {error && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

            <span>{error}</span>

            <button
              onClick={() => setError("")}
              className="hover:text-red-900"
            >
              <X size={18} />
            </button>

          </div>
        )}

        {/* -------------------------------- */}
        {/* STAT CARDS */}
        {/* -------------------------------- */}

        <div className="grid gap-5 md:grid-cols-3">

          {/* TOTAL */}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm font-medium text-slate-500">
                  Total Meetings
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {meetings.length}
                </p>
              </div>

              <CalendarDays
                size={28}
                className="text-slate-600"
              />

            </div>

          </div>

          {/* COMPLETED */}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm font-medium text-slate-500">
                  Completed
                </p>

                <p className="mt-2 text-3xl font-bold text-green-600">
                  {completedMeetings}
                </p>
              </div>

              <CheckCircle
                size={28}
                className="text-green-600"
              />

            </div>

          </div>

          {/* PROCESSING */}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm font-medium text-slate-500">
                  Processing
                </p>

                <p className="mt-2 text-3xl font-bold text-yellow-600">
                  {processingMeetings}
                </p>
              </div>

              <LoaderCircle
                size={28}
                className="text-yellow-600"
              />

            </div>

          </div>

        </div>

        {/* -------------------------------- */}
        {/* MEETINGS */}
        {/* -------------------------------- */}

        <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* HEADER */}

          <div className="flex items-center justify-between border-b px-6 py-5">

            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Recent Meetings
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Your latest uploaded meetings
              </p>
            </div>

            <button
              onClick={fetchMeetings}
              disabled={loading}
              className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                size={18}
                className={
                  loading ? "animate-spin" : ""
                }
              />
            </button>

          </div>

          {/* -------------------------------- */}
          {/* LOADING */}
          {/* -------------------------------- */}

          {loading && (
            <div className="flex flex-col items-center justify-center py-16">

              <LoaderCircle
                size={32}
                className="animate-spin text-slate-500"
              />

              <p className="mt-3 text-sm text-slate-500">
                Loading meetings...
              </p>

            </div>
          )}

          {/* -------------------------------- */}
          {/* EMPTY */}
          {/* -------------------------------- */}

          {!loading && meetings.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">

              <div className="rounded-full bg-slate-100 p-4">
                <FileAudio
                  size={32}
                  className="text-slate-500"
                />
              </div>

              <h4 className="mt-4 text-lg font-semibold text-slate-900">
                No meetings yet
              </h4>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                Upload your first meeting recording and
                let AI generate the transcript, summary,
                decisions, and action items.
              </p>

              <button
                onClick={() => navigate("/new-meeting")}
                className="mt-5 flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700"
              >
                <Plus size={17} />
                Upload Your First Meeting
              </button>

            </div>
          )}

          {/* -------------------------------- */}
          {/* MEETING LIST */}
          {/* -------------------------------- */}

          {!loading && meetings.length > 0 && (
            <div className="divide-y">

              {meetings.map((meeting) => (

                <div
                  key={meeting.id}
                  onClick={() => openMeeting(meeting.id)}
                  className="flex cursor-pointer flex-col gap-4 px-6 py-5 hover:bg-slate-50 md:flex-row md:items-center md:justify-between transition"
                >

                  {/* MEETING INFO */}

                  <div className="flex items-start gap-4">

                    <div className="rounded-lg bg-slate-100 p-3">
                      <FileAudio
                        size={22}
                        className="text-slate-700"
                      />
                    </div>

                    <div>

                      <h4 className="font-semibold text-slate-900">
                        {meeting.title ||
                          `Meeting #${meeting.id}`}
                      </h4>

                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">

                        <span className="flex items-center gap-1">
                          <CalendarDays size={15} />

                          {formatDate(
                            meeting.created_at
                          )}
                        </span>

                        {meeting.duration && (
                          <span className="flex items-center gap-1">
                            <Clock size={15} />

                            {meeting.duration}s
                          </span>
                        )}

                      </div>

                    </div>

                  </div>

                  {/* STATUS */}

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(
                      meeting.status
                    )}`}
                  >
                    {formatStatus(meeting.status)}
                  </span>

                </div>

              ))}

            </div>
          )}

        </div>

      </main>

    </div>
  );
}




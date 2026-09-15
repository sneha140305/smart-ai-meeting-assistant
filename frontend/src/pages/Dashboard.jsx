import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Video,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 6;

function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  const [currentPage, setCurrentPage] = useState(1);

  const fetchMeetings = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await api.get("/meetings/");

      setMeetings(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to fetch meetings:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to load your meetings."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

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

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";

    return new Date(dateString).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const formatDuration = (duration) => {
    if (!duration) return "Duration unavailable";

    const totalSeconds = Number(duration);

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
      return `${seconds}s`;
    }

    return `${minutes}m ${seconds}s`;
  };

  const filteredMeetings = useMemo(() => {
    let result = [...meetings];

    const query = searchQuery.trim().toLowerCase();

    if (query) {
      result = result.filter((meeting) =>
        `${meeting.title || ""} ${meeting.file_name || ""}`
          .toLowerCase()
          .includes(query)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter(
        (meeting) => meeting.status === statusFilter
      );
    }

    result.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();

      return sortOrder === "newest"
        ? dateB - dateA
        : dateA - dateB;
    });

    return result;
  }, [
    meetings,
    searchQuery,
    statusFilter,
    sortOrder,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMeetings.length / PAGE_SIZE)
  );

  const paginatedMeetings = filteredMeetings.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortOrder]);

  const totalMeetings = meetings.length;

  const completedMeetings = meetings.filter(
    (meeting) => meeting.status === "completed"
  ).length;

  const processingMeetings = meetings.filter(
    (meeting) =>
      [
        "processing",
        "preprocessing",
        "audio_ready",
        "transcribing",
        "diarizing",
        "analyzing",
      ].includes(meeting.status)
  ).length;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}

      <header className="bg-white border-b border-slate-200">

        <div className="max-w-7xl mx-auto px-6 py-4">

          <div className="flex items-center justify-between">

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Meeting Assistant
              </h1>

              <p className="text-sm text-slate-500 mt-1">
                Your AI-powered meeting workspace
              </p>
            </div>

            <div className="flex items-center gap-3">

              <button
                onClick={() => fetchMeetings(true)}
                disabled={refreshing}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition disabled:opacity-50"
                title="Refresh meetings"
              >
                <RefreshCw
                  className={`w-5 h-5 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
              </button>

              <button
                onClick={() => navigate("/new-meeting")}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition"
              >
                <Plus className="w-4 h-4" />
                New Meeting
              </button>

              <button
                onClick={handleLogout}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>

            </div>

          </div>

        </div>

      </header>


      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats */}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Total Meetings
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {totalMeetings}
            </p>

          </div>


          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Completed
            </p>

            <p className="text-3xl font-bold text-green-600 mt-2">
              {completedMeetings}
            </p>

          </div>


          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Processing
            </p>

            <p className="text-3xl font-bold text-amber-600 mt-2">
              {processingMeetings}
            </p>

          </div>

        </div>


        {/* Search and filters */}

        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">

          <div className="flex flex-col lg:flex-row gap-3">

            {/* Search */}

            <div className="relative flex-1">

              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                placeholder="Search meetings..."
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
              />

            </div>


            {/* Status */}

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              className="px-4 py-3 border border-slate-200 rounded-xl bg-white outline-none"
            >
              <option value="all">
                All statuses
              </option>

              <option value="completed">
                Completed
              </option>

              <option value="processing">
                Processing
              </option>

              <option value="transcribing">
                Transcribing
              </option>

              <option value="diarizing">
                Identifying Speakers
              </option>

              <option value="analyzing">
                Analyzing
              </option>

              <option value="analysis_failed">
                Analysis Failed
              </option>

              <option value="diarization_failed">
                Diarization Failed
              </option>

            </select>


            {/* Sort */}

            <select
              value={sortOrder}
              onChange={(e) =>
                setSortOrder(e.target.value)
              }
              className="px-4 py-3 border border-slate-200 rounded-xl bg-white outline-none"
            >
              <option value="newest">
                Newest first
              </option>

              <option value="oldest">
                Oldest first
              </option>

            </select>

          </div>


          <div className="flex items-center justify-between mt-3 text-sm text-slate-500">

            <span>
              Showing {filteredMeetings.length} meeting
              {filteredMeetings.length !== 1 ? "s" : ""}
            </span>

            {(searchQuery || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="text-slate-900 font-medium hover:underline"
              >
                Clear filters
              </button>
            )}

          </div>

        </div>


        {/* Loading */}

        {loading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">

            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-slate-500" />

            <p className="text-slate-500 mt-4">
              Loading your meetings...
            </p>

          </div>
        )}


        {/* Error */}

        {!loading && error && (
          <div className="bg-white border border-red-200 rounded-2xl p-8 text-center">

            <p className="text-red-600 font-medium">
              {error}
            </p>

            <button
              onClick={() => fetchMeetings()}
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl"
            >
              Try Again
            </button>

          </div>
        )}


        {/* Empty */}

        {!loading &&
          !error &&
          filteredMeetings.length === 0 && (

            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">

              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">

                <Video className="w-7 h-7 text-slate-500" />

              </div>

              <h2 className="text-lg font-semibold text-slate-900 mt-5">
                {meetings.length === 0
                  ? "No meetings yet"
                  : "No meetings found"}
              </h2>

              <p className="text-slate-500 mt-2">
                {meetings.length === 0
                  ? "Upload your first meeting to start generating AI insights."
                  : "Try changing your search or filters."}
              </p>

              {meetings.length === 0 && (
                <button
                  onClick={() =>
                    navigate("/new-meeting")
                  }
                  className="mt-5 inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl"
                >
                  <Plus className="w-4 h-4" />
                  Upload Meeting
                </button>
              )}

            </div>
          )}


        {/* Meeting list */}

        {!loading &&
          !error &&
          paginatedMeetings.length > 0 && (

            <div className="space-y-4">

              {paginatedMeetings.map((meeting) => (

                <button
                  key={meeting.id}
                  onClick={() =>
                    navigate(`/meetings/${meeting.id}`)
                  }
                  className="w-full text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition"
                >

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">

                    <div className="flex items-start gap-4">

                      <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">

                        <Video className="w-5 h-5 text-slate-600" />

                      </div>

                      <div>

                        <h3 className="font-semibold text-slate-900 text-lg">
                          {meeting.title ||
                            "Untitled Meeting"}
                        </h3>

                        <p className="text-sm text-slate-500 mt-1">
                          {meeting.file_name}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-500">

                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
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


                    <span
                      className={`self-start md:self-center px-3 py-1.5 rounded-full border text-sm font-medium ${getStatusClass(
                        meeting.status
                      )}`}
                    >
                      {getStatusLabel(
                        meeting.status
                      )}
                    </span>

                  </div>

                </button>

              ))}


              {/* Pagination */}

              {totalPages > 1 && (

                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-4">

                  <p className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </p>

                  <div className="flex items-center gap-2">

                    <button
                      disabled={currentPage === 1}
                      onClick={() =>
                        setCurrentPage(
                          (page) => page - 1
                        )
                      }
                      className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                      disabled={
                        currentPage === totalPages
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) => page + 1
                        )
                      }
                      className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                  </div>

                </div>

              )}

            </div>
          )}

      </main>

    </div>
  );
}

export default Dashboard;
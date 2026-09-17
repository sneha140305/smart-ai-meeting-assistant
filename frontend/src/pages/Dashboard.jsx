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
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  const [currentPage, setCurrentPage] = useState(1);

  // --------------------------------------------------
  // Fetch all meetings
  // --------------------------------------------------

  const fetchMeetings = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await api.get("/meetings/");

      setMeetings(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (err) {
      console.error(
        "Failed to fetch meetings:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to load your meetings."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --------------------------------------------------
  // Search meeting knowledge
  // --------------------------------------------------

  const searchMeetingKnowledge = async (query) => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    try {
      setSearching(true);

      const response = await api.get(
        "/meetings/search",
        {
          params: {
            q: trimmedQuery,
          },
        }
      );

      setSearchResults(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (err) {
      console.error(
        "Meeting search failed:",
        err
      );

      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // --------------------------------------------------
  // Initial load
  // --------------------------------------------------

  useEffect(() => {
    fetchMeetings();
  }, []);

  // --------------------------------------------------
  // Debounced knowledge search
  // --------------------------------------------------

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(() => {
      searchMeetingKnowledge(trimmedQuery);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --------------------------------------------------
  // Status labels
  // --------------------------------------------------

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

    return (
      labels[status] ||
      status ||
      "Unknown"
    );
  };

  // --------------------------------------------------
  // Status styling
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Format date
  // --------------------------------------------------

  const formatDate = (dateString) => {
    if (!dateString) {
      return "Unknown date";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // --------------------------------------------------
  // Format duration
  // --------------------------------------------------

  const formatDuration = (duration) => {
    if (
      duration === null ||
      duration === undefined ||
      duration === ""
    ) {
      return "Duration unavailable";
    }

    const totalSeconds = Number(duration);

    if (Number.isNaN(totalSeconds)) {
      return "Duration unavailable";
    }

    const minutes = Math.floor(
      totalSeconds / 60
    );

    const seconds = Math.floor(
      totalSeconds % 60
    );

    if (minutes === 0) {
      return `${seconds}s`;
    }

    return `${minutes}m ${String(
      seconds
    ).padStart(2, "0")}s`;
  };

  // --------------------------------------------------
  // Local filtering
  // --------------------------------------------------

  const filteredMeetings = useMemo(() => {
    let result = [...meetings];

    if (statusFilter !== "all") {
      result = result.filter(
        (meeting) =>
          meeting.status === statusFilter
      );
    }

    result.sort((a, b) => {
      const dateA = new Date(
        a.created_at || 0
      ).getTime();

      const dateB = new Date(
        b.created_at || 0
      ).getTime();

      return sortOrder === "newest"
        ? dateB - dateA
        : dateA - dateB;
    });

    return result;
  }, [
    meetings,
    statusFilter,
    sortOrder,
  ]);

  // --------------------------------------------------
  // Active results
  // --------------------------------------------------

  const displayedMeetings =
    searchResults !== null
      ? searchResults.filter((meeting) => {
          if (statusFilter === "all") {
            return true;
          }

          return (
            meeting.status ===
            statusFilter
          );
        })
      : filteredMeetings;

  // --------------------------------------------------
  // Sort search results too
  // --------------------------------------------------

  const sortedDisplayedMeetings =
    useMemo(() => {
      const result = [
        ...displayedMeetings,
      ];

      result.sort((a, b) => {
        const dateA = new Date(
          a.created_at || 0
        ).getTime();

        const dateB = new Date(
          b.created_at || 0
        ).getTime();

        return sortOrder === "newest"
          ? dateB - dateA
          : dateA - dateB;
      });

      return result;
    }, [
      displayedMeetings,
      sortOrder,
    ]);

  // --------------------------------------------------
  // Pagination
  // --------------------------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedDisplayedMeetings.length /
        PAGE_SIZE
    )
  );

  const paginatedMeetings =
    sortedDisplayedMeetings.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );

  // --------------------------------------------------
  // Reset page when filters/search change
  // --------------------------------------------------

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    statusFilter,
    sortOrder,
  ]);

  // --------------------------------------------------
  // Dashboard statistics
  // --------------------------------------------------

  const totalMeetings =
    meetings.length;

  const completedMeetings =
    meetings.filter(
      (meeting) =>
        meeting.status === "completed"
    ).length;

  const processingMeetings =
    meetings.filter((meeting) =>
      [
        "processing",
        "preprocessing",
        "audio_ready",
        "transcribing",
        "diarizing",
        "analyzing",
      ].includes(meeting.status)
    ).length;

  // --------------------------------------------------
  // Clear search
  // --------------------------------------------------

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
    setCurrentPage(1);
  };

  // --------------------------------------------------
  // Clear all filters
  // --------------------------------------------------

  const clearFilters = () => {
    setSearchQuery("");
    setSearchResults(null);
    setStatusFilter("all");
    setSortOrder("newest");
    setCurrentPage(1);
  };

  // --------------------------------------------------
  // Logout
  // --------------------------------------------------

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ================= HEADER ================= */}

      <header className="bg-white border-b border-slate-200">

        <div className="max-w-7xl mx-auto px-6 py-4">

          <div className="flex items-center justify-between gap-4">

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Meeting Assistant
              </h1>

              <p className="text-sm text-slate-500 mt-1">
                Your AI-powered meeting workspace
              </p>
            </div>

            <div className="flex items-center gap-3">

              {/* Refresh */}

              <button
                onClick={() =>
                  fetchMeetings(true)
                }
                disabled={refreshing}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition disabled:opacity-50"
                title="Refresh meetings"
              >
                <RefreshCw
                  className={`w-5 h-5 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />
              </button>

              {/* New Meeting */}

              <button
                onClick={() =>
                  navigate(
                    "/new-meeting"
                  )
                }
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition"
              >
                <Plus className="w-4 h-4" />

                <span className="hidden sm:inline">
                  New Meeting
                </span>
              </button>

              {/* Logout */}

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


      {/* ================= MAIN ================= */}

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* ================= STATS ================= */}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">

          {/* Total */}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Total Meetings
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {totalMeetings}
            </p>

          </div>


          {/* Completed */}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Completed
            </p>

            <p className="text-3xl font-bold text-green-600 mt-2">
              {completedMeetings}
            </p>

          </div>


          {/* Processing */}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <p className="text-sm text-slate-500">
              Processing
            </p>

            <p className="text-3xl font-bold text-amber-600 mt-2">
              {processingMeetings}
            </p>

          </div>

        </div>


        {/* ================= SEARCH + FILTERS ================= */}

        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">

          <div className="flex flex-col lg:flex-row gap-3">

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
                placeholder="Search meetings, transcripts, decisions, tasks..."
                className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
              />

              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  title="Clear search"
                >
                  ×
                </button>
              )}

            </div>


            {/* Status */}

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="px-4 py-3 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-slate-200"
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

              <option value="preprocessing">
                Preparing
              </option>

              <option value="audio_ready">
                Audio Ready
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
                setSortOrder(
                  e.target.value
                )
              }
              className="px-4 py-3 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-slate-200"
            >

              <option value="newest">
                Newest first
              </option>

              <option value="oldest">
                Oldest first
              </option>

            </select>

          </div>


          {/* Search status */}

          {searchQuery.trim() && (
            <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">

              {searching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />

                  Searching meeting knowledge...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />

                  Searching across transcripts,
                  summaries, decisions and
                  action items
                </>
              )}

            </div>
          )}


          {/* Result count */}

          {!searching && (
            <div className="flex items-center justify-between mt-3 text-sm text-slate-500">

              <span>

                {searchResults !== null ? (
                  <>
                    Found{" "}
                    <span className="font-semibold text-slate-900">
                      {sortedDisplayedMeetings.length}
                    </span>{" "}
                    matching meeting
                    {sortedDisplayedMeetings.length !==
                    1
                      ? "s"
                      : ""}{" "}
                    for{" "}
                    <span className="font-semibold text-slate-900">
                      "{searchQuery.trim()}"
                    </span>
                  </>
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-semibold text-slate-900">
                      {filteredMeetings.length}
                    </span>{" "}
                    meeting
                    {filteredMeetings.length !==
                    1
                      ? "s"
                      : ""}
                  </>
                )}

              </span>


              {(searchQuery ||
                statusFilter !==
                  "all" ||
                sortOrder !==
                  "newest") && (

                <button
                  onClick={
                    clearFilters
                  }
                  className="text-slate-900 font-medium hover:underline"
                >
                  Clear filters
                </button>

              )}

            </div>
          )}

        </div>


        {/* ================= LOADING ================= */}

        {loading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">

            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-slate-500" />

            <p className="text-slate-500 mt-4">
              Loading your meetings...
            </p>

          </div>
        )}


        {/* ================= ERROR ================= */}

        {!loading && error && (
          <div className="bg-white border border-red-200 rounded-2xl p-8 text-center">

            <p className="text-red-600 font-medium">
              {error}
            </p>

            <button
              onClick={() =>
                fetchMeetings()
              }
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800"
            >
              Try Again
            </button>

          </div>
        )}


        {/* ================= EMPTY STATE ================= */}

        {!loading &&
          !error &&
          !searching &&
          sortedDisplayedMeetings.length ===
            0 && (

            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">

              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">

                <Search className="w-7 h-7 text-slate-500" />

              </div>


              <h2 className="text-lg font-semibold text-slate-900 mt-5">

                {searchResults !==
                null
                  ? "No matching meetings"
                  : meetings.length ===
                    0
                  ? "No meetings yet"
                  : "No meetings found"}

              </h2>


              <p className="text-slate-500 mt-2">

                {searchResults !==
                null
                  ? `We couldn't find "${searchQuery.trim()}" in your meeting knowledge.`
                  : meetings.length ===
                    0
                  ? "Upload your first meeting to start generating AI insights."
                  : "Try changing your search or filters."}

              </p>


              {searchResults !==
                null && (
                <button
                  onClick={
                    clearSearch
                  }
                  className="mt-5 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800"
                >
                  Clear Search
                </button>
              )}


              {meetings.length ===
                0 &&
                searchResults ===
                  null && (
                  <button
                    onClick={() =>
                      navigate(
                        "/new-meeting"
                      )
                    }
                    className="mt-5 inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800"
                  >
                    <Plus className="w-4 h-4" />

                    Upload Meeting
                  </button>
                )}

            </div>
          )}


        {/* ================= MEETING LIST ================= */}

        {!loading &&
          !error &&
          !searching &&
          paginatedMeetings.length >
            0 && (

            <div className="space-y-4">

              {paginatedMeetings.map(
                (meeting) => (

                  <button
                    key={meeting.id}
                    onClick={() =>
                      navigate(
                        `/meetings/${meeting.id}`
                      )
                    }
                    className="w-full text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition"
                  >

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">

                      {/* Meeting information */}

                      <div className="flex items-start gap-4">

                        <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">

                          <Video className="w-5 h-5 text-slate-600" />

                        </div>


                        <div className="min-w-0">

                          <h3 className="font-semibold text-slate-900 text-lg truncate">

                            {meeting.title ||
                              "Untitled Meeting"}

                          </h3>


                          <p className="text-sm text-slate-500 mt-1 truncate">

                            {meeting.file_name ||
                              "No file name"}

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


                      {/* Status */}

                      <span
                        className={`self-start md:self-center px-3 py-1.5 rounded-full border text-sm font-medium whitespace-nowrap ${getStatusClass(
                          meeting.status
                        )}`}
                      >

                        {getStatusLabel(
                          meeting.status
                        )}

                      </span>

                    </div>

                  </button>

                )
              )}


              {/* ================= PAGINATION ================= */}

              {totalPages > 1 && (

                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-4">

                  <p className="text-sm text-slate-500">

                    Page{" "}
                    <span className="font-medium text-slate-900">
                      {currentPage}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-slate-900">
                      {totalPages}
                    </span>

                  </p>


                  <div className="flex items-center gap-2">

                    <button
                      disabled={
                        currentPage ===
                        1
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            page - 1
                        )
                      }
                      className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>


                    <button
                      disabled={
                        currentPage ===
                        totalPages
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            page + 1
                        )
                      }
                      className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
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


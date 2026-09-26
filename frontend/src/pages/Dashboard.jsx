import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  RefreshCw,
  LogOut,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X
} from "lucide-react";

import api from "../services/api";
import MeetingStatusBadge from "../components/MeetingStatusBadge";
import MeetingProcessingBar from "../components/MeetingProcessingBar";

export default function Dashboard() {
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 6;

  // --------------------------------------------------
  // FETCH MEETINGS
  // --------------------------------------------------

  const fetchMeetings = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      setError("");

      const response = await api.get("/meetings/");

      setMeetings(response.data);

    } catch (err) {
      console.error("Failed to fetch meetings:", err);

      setError(
        err.response?.data?.detail ||
          "Failed to load meetings."
      );
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    fetchMeetings();
  }, []);

  // --------------------------------------------------
  // PROCESSING MEETINGS
  // --------------------------------------------------

  const processingMeetings = useMemo(() => {
    return meetings.filter((meeting) =>
      [
        "processing",
        "transcribing",
        "diarizing",
        "analyzing"
      ].includes(meeting.status)
    );
  }, [meetings]);

  const hasProcessingMeetings =
    processingMeetings.length > 0;

  // --------------------------------------------------
  // LIVE DASHBOARD REFRESH
  // --------------------------------------------------

  useEffect(() => {
    if (!hasProcessingMeetings) {
      return;
    }

    const refreshMeetings = async () => {
      try {
        const response = await api.get("/meetings/");

        setMeetings(response.data);
      } catch (err) {
        console.error(
          "Failed to refresh meeting status:",
          err
        );
      }
    };

    const interval = setInterval(
      refreshMeetings,
      2000
    );

    return () => {
      clearInterval(interval);
    };
  }, [hasProcessingMeetings]);

  // --------------------------------------------------
  // BACKEND KNOWLEDGE SEARCH
  // --------------------------------------------------

  useEffect(() => {
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);

        const response = await api.get(
          "/meetings/search",
          {
            params: {
              q: query
            }
          }
        );

        setSearchResults(response.data);

      } catch (err) {
        console.error(
          "Meeting search failed:",
          err
        );

        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --------------------------------------------------
  // REFRESH BUTTON
  // --------------------------------------------------

  const handleRefresh = async () => {
    try {
      setRefreshing(true);

      await fetchMeetings(false);

      if (searchQuery.trim()) {
        const response = await api.get(
          "/meetings/search",
          {
            params: {
              q: searchQuery.trim()
            }
          }
        );

        setSearchResults(response.data);
      }

    } catch (err) {
      console.error(
        "Refresh failed:",
        err
      );
    } finally {
      setRefreshing(false);
    }
  };

  // --------------------------------------------------
  // FILTER + SEARCH DATA
  // --------------------------------------------------

  const activeMeetings = useMemo(() => {
    const source = searchQuery.trim()
      ? searchResults
      : meetings;

    let result = [...source];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(
        (meeting) =>
          meeting.status === statusFilter
      );
    }

    // Sorting
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
    searchResults,
    searchQuery,
    statusFilter,
    sortOrder
  ]);

  // --------------------------------------------------
  // PAGINATION
  // --------------------------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(
      activeMeetings.length /
        itemsPerPage
    )
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedMeetings =
    activeMeetings.slice(
      (safeCurrentPage - 1) *
        itemsPerPage,
      safeCurrentPage *
        itemsPerPage
    );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    statusFilter,
    sortOrder
  ]);

  // --------------------------------------------------
  // STATS
  // --------------------------------------------------

  const totalMeetings =
    meetings.length;

  const completedMeetings =
    meetings.filter(
      (meeting) =>
        meeting.status === "completed"
    ).length;

  const failedMeetings =
    meetings.filter(
      (meeting) =>
        [
          "processing_failed",
          "analysis_failed"
        ].includes(meeting.status)
    ).length;

  // --------------------------------------------------
  // FORMAT DATE
  // --------------------------------------------------

  const formatDate = (date) => {
    if (!date) {
      return "Unknown date";
    }

    try {
      return new Date(date).toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }
      );
    } catch {
      return "Unknown date";
    }
  };

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem("token");

    navigate("/");
  };

  // --------------------------------------------------
  // CLEAR SEARCH
  // --------------------------------------------------

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setCurrentPage(1);
  };

  // --------------------------------------------------
  // EMPTY STATE MESSAGE
  // --------------------------------------------------

  const getEmptyMessage = () => {
    if (searchQuery.trim()) {
      return "No meetings matched your search.";
    }

    if (statusFilter !== "all") {
      return "No meetings found with this status.";
    }

    return "No meetings uploaded yet.";
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50">

      {/* -------------------------------------------- */}
      {/* HEADER */}
      {/* -------------------------------------------- */}

      <header className="border-b bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Smart AI Meeting Assistant
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage, analyze and search your meetings
            </p>
          </div>

          <div className="flex items-center gap-3">

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
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

            <button
              onClick={() =>
                navigate("/new-meeting")
              }
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Plus size={18} />

              New Meeting
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <LogOut size={17} />

              Logout
            </button>

          </div>

        </div>

      </header>

      {/* -------------------------------------------- */}
      {/* MAIN */}
      {/* -------------------------------------------- */}

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* ERROR */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">

            <AlertCircle size={20} />

            <p className="text-sm">
              {error}
            </p>

          </div>
        )}

        {/* ------------------------------------------ */}
        {/* PROCESSING BANNER */}
        {/* ------------------------------------------ */}

        {hasProcessingMeetings && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">

                <Loader2
                  size={20}
                  className="animate-spin text-blue-600"
                />

              </div>

              <div>

                <h3 className="font-semibold text-blue-900">
                  AI processing in progress
                </h3>

                <p className="text-sm text-blue-700">

                  {processingMeetings.length === 1
                    ? "Your meeting is being processed automatically."
                    : `${processingMeetings.length} meetings are being processed automatically.`}

                </p>

              </div>

            </div>

          </div>
        )}

        {/* ------------------------------------------ */}
        {/* STATS */}
        {/* ------------------------------------------ */}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* Total */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Total Meetings
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {totalMeetings}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100">

                <FileText
                  size={21}
                  className="text-blue-600"
                />

              </div>

            </div>

          </div>

          {/* Completed */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Completed
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {completedMeetings}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100">

                <CheckCircle
                  size={21}
                  className="text-green-600"
                />

              </div>

            </div>

          </div>

          {/* Processing */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Currently Processing
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {processingMeetings.length}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100">

                <Clock
                  size={21}
                  className="text-orange-600"
                />

              </div>

            </div>

          </div>

          {/* Failed */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Failed
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {failedMeetings}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100">

                <AlertCircle
                  size={21}
                  className="text-red-600"
                />

              </div>

            </div>

          </div>

        </div>

        {/* ------------------------------------------ */}
        {/* SEARCH + FILTERS */}
        {/* ------------------------------------------ */}

        <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">

          <div className="flex flex-col gap-4 lg:flex-row">

            {/* Search */}
            <div className="relative flex-1">

              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                placeholder="Search meetings, transcripts, decisions, tasks..."
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X size={17} />
                </button>
              )}

              {searching && (
                <Loader2
                  size={17}
                  className="absolute right-10 top-1/2 -translate-y-1/2 animate-spin text-blue-500"
                />
              )}

            </div>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">
                All Status
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
                AI Analyzing
              </option>

              <option value="completed">
                Completed
              </option>

              <option value="processing_failed">
                Failed
              </option>
            </select>

            {/* Sort */}
            <button
              onClick={() =>
                setSortOrder(
                  sortOrder === "newest"
                    ? "oldest"
                    : "newest"
                )
              }
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <ArrowUpDown size={17} />

              {sortOrder === "newest"
                ? "Newest"
                : "Oldest"}
            </button>

          </div>

          {/* Search indicator */}
          {searchQuery.trim() && (
            <div className="mt-3 text-xs text-gray-500">

              {searching
                ? "Searching meeting knowledge..."
                : `${activeMeetings.length} result${
                    activeMeetings.length === 1
                      ? ""
                      : "s"
                  } found`}

            </div>
          )}

        </div>

        {/* ------------------------------------------ */}
        {/* LOADING */}
        {/* ------------------------------------------ */}

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">

            <div className="text-center">

              <Loader2
                size={32}
                className="mx-auto animate-spin text-blue-600"
              />

              <p className="mt-3 text-sm text-gray-500">
                Loading meetings...
              </p>

            </div>

          </div>
        ) : paginatedMeetings.length === 0 ? (

          /* ---------------------------------------- */
          /* EMPTY STATE */
          /* ---------------------------------------- */

          <div className="rounded-xl border bg-white px-6 py-16 text-center shadow-sm">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">

              <FileText
                size={25}
                className="text-gray-400"
              />

            </div>

            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              {getEmptyMessage()}
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              {searchQuery.trim()
                ? "Try a different keyword or clear the search."
                : "Upload your first meeting to start generating AI insights."}
            </p>

            {!searchQuery.trim() &&
              statusFilter === "all" && (
                <button
                  onClick={() =>
                    navigate("/new-meeting")
                  }
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus size={18} />

                  Upload Meeting
                </button>
              )}

          </div>

        ) : (

          /* ---------------------------------------- */
          /* MEETING GRID */
          /* ---------------------------------------- */

          <>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">

              {paginatedMeetings.map(
                (meeting) => {

                  const isProcessing = [
                    "processing",
                    "transcribing",
                    "diarizing",
                    "analyzing"
                  ].includes(
                    meeting.status
                  );

                  return (
                    <div
                      key={meeting.id}
                      onClick={() =>
                        navigate(
                          `/meetings/${meeting.id}`
                        )
                      }
                      className="group cursor-pointer rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                    >

                      {/* Card header */}
                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <h3 className="truncate text-base font-semibold text-gray-900 group-hover:text-blue-600">

                            {meeting.title ||
                              meeting.file_name ||
                              `Meeting ${meeting.id}`}

                          </h3>

                          <p className="mt-1 truncate text-xs text-gray-400">

                            {meeting.file_name ||
                              "Meeting recording"}

                          </p>

                        </div>

                        <MeetingStatusBadge
                          status={
                            meeting.status
                          }
                        />

                      </div>

                      {/* Description / Summary */}
                      {meeting.summary && (
                        <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-600">
                          {meeting.summary}
                        </p>
                      )}

                      {/* Processing */}
                      {isProcessing && (
                        <MeetingProcessingBar
                          meeting={meeting}
                        />
                      )}

                      {/* Metadata */}
                      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-gray-500">

                        <div className="flex items-center gap-1.5">

                          <Calendar
                            size={14}
                          />

                          {formatDate(
                            meeting.created_at
                          )}

                        </div>

                        {meeting.duration && (
                          <div className="flex items-center gap-1.5">

                            <Clock
                              size={14}
                            />

                            {Math.round(
                              meeting.duration
                            )}s

                          </div>
                        )}

                        {meeting.speaker_count && (
                          <div className="flex items-center gap-1.5">

                            <span>
                              {meeting.speaker_count}
                            </span>

                            <span>
                              speakers
                            </span>

                          </div>
                        )}

                      </div>

                      {/* Score */}
                      {meeting.effectiveness_score !==
                        null &&
                        meeting.effectiveness_score !==
                          undefined && (
                          <div className="mt-4 flex items-center justify-between border-t pt-4">

                            <span className="text-xs text-gray-500">
                              Effectiveness
                            </span>

                            <span className="font-semibold text-gray-800">
                              {
                                meeting.effectiveness_score
                              }
                              /100
                            </span>

                          </div>
                        )}

                    </div>
                  );
                }
              )}

            </div>

            {/* -------------------------------------- */}
            {/* PAGINATION */}
            {/* -------------------------------------- */}

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">

                <button
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          1,
                          page - 1
                        )
                    )
                  }
                  disabled={
                    safeCurrentPage === 1
                  }
                  className="flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={17} />

                  Previous
                </button>

                <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">

                  Page{" "}
                  {safeCurrentPage} of{" "}
                  {totalPages}

                </div>

                <button
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.min(
                          totalPages,
                          page + 1
                        )
                    )
                  }
                  disabled={
                    safeCurrentPage ===
                    totalPages
                  }
                  className="flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next

                  <ChevronRight size={17} />

                </button>

              </div>
            )}

          </>
        )}

      </main>

    </div>
  );
}

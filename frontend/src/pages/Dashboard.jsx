import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileAudio,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic2,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  Sun,
  Moon,
  Users,
  X,
  Zap,
} from "lucide-react";
import api from "../services/api";
import MeetingStatusBadge from "../components/MeetingStatusBadge";
import MeetingProcessingBar from "../components/MeetingProcessingBar";

const PROCESSING = ["processing", "audio_ready", "transcribing", "diarizing", "analyzing"];
const FAILED = ["processing_failed", "analysis_failed"];

function dateLabel(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function durationLabel(value) {
  if (!value) return null;
  const seconds = Math.round(Number(value));
  if (!Number.isFinite(seconds)) return null;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes ? `${minutes}m ${String(remaining).padStart(2, "0")}s` : `${remaining}s`;
}

function scoreTone(score) {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-accent";
  if (score >= 50) return "text-amber-400";
  return "text-rose-400";
}

function ScoreRing({ score }) {
  const value = Number(score);
  if (!Number.isFinite(value)) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-theme bg-surface/[0.04] text-[10px] font-semibold text-muted">
        N/A
      </div>
    );
  }

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 44 44" className="-rotate-90">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={scoreTone(value)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
        {value}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, change, positive = true }) {
  return (
    <div className="rounded-2xl border border-theme bg-surface/[0.035] p-4">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/[0.06] text-secondary">
          <Icon size={17} />
        </div>
        {change && (
          <span className={`flex items-center gap-1 text-[11px] font-semibold ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {change}
          </span>
        )}
      </div>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.13em] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-primary">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("meetingai-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: light)")?.matches
      ? "light"
      : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("meetingai-theme", theme);
  }, [theme]);

  const isLight = theme === "light";
  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  const [meetings, setMeetings] = useState([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sortNewest, setSortNewest] = useState(true);
  const [page, setPage] = useState(1);

  const perPage = 5;

  const loadMeetings = async () => {
    const response = await api.get("/meetings/");
    setMeetings(Array.isArray(response.data) ? response.data : []);
  };

  useEffect(() => {
    loadMeetings()
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, []);

  const processing = useMemo(
    () => meetings.filter((m) => PROCESSING.includes(m.status)),
    [meetings]
  );

  useEffect(() => {
    if (!processing.length) return undefined;

    const timer = setInterval(() => {
      loadMeetings().catch((error) => console.error(error));
    }, 3000);

    return () => clearInterval(timer);
  }, [processing.length]);

  useEffect(() => {
    const text = query.trim();

    if (!text) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const response = await api.get("/meetings/search", { params: { q: text } });
        setSearchResults(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error(error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const completed = meetings.filter((m) => m.status === "completed");
  const failed = meetings.filter((m) => FAILED.includes(m.status));

  const avgScore = useMemo(() => {
    const scores = completed
      .map((m) => Number(m.effectiveness_score))
      .filter((n) => Number.isFinite(n));

    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  }, [completed]);

  const words = useMemo(
    () => completed.reduce((sum, m) => sum + (Number(m.total_words) || 0), 0),
    [completed]
  );

  const source = query.trim() ? searchResults : meetings;

  const visibleMeetings = useMemo(() => {
    return [...source].sort((a, b) => {
      const first = new Date(a.created_at || 0).getTime();
      const second = new Date(b.created_at || 0).getTime();
      return sortNewest ? second - first : first - second;
    });
  }, [source, sortNewest]);

  const totalPages = Math.max(1, Math.ceil(visibleMeetings.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageMeetings = visibleMeetings.slice((safePage - 1) * perPage, safePage * perPage);

  const refresh = async () => {
    try {
      setRefreshing(true);
      await loadMeetings();
    } finally {
      setRefreshing(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    navigate("/");
  };

  useEffect(() => {
    setPage(1);
  }, [query, sortNewest]);

  const navItems = [
    { label: "Overview", icon: LayoutDashboard, active: true },
    { label: "Meetings", icon: FileText, action: () => document.getElementById("meetings")?.scrollIntoView({ behavior: "smooth" }) },
    { label: "Analytics", icon: BarChart3, action: () => document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" }) },
  ];

  return (
    <div className="min-h-screen bg-app text-primary">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[18%] top-[-180px] h-[500px] w-[500px] rounded-full bg-cyan-500/[0.07] blur-[120px]" />
        <div className="absolute right-[-120px] top-[18%] h-[460px] w-[460px] rounded-full bg-violet-500/[0.06] blur-[120px]" />
      </div>

      {/* sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[238px] border-r border-theme bg-sidebar px-4 py-5 backdrop-blur-2xl lg:block">
        <div className="flex h-full flex-col">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-3 px-2">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 via-blue-500 to-violet-500 shadow-lg shadow-blue-500/20">
              <Sparkles size={19} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-bold tracking-tight">Meeting<span className="text-accent">AI</span></p>
              <p className="text-[10px] text-muted">Intelligence workspace</p>
            </div>
          </button>

          <div className="mt-9 px-2 text-[9px] font-bold uppercase tracking-[0.2em] text-subtle">Workspace</div>

          <nav className="mt-3 space-y-1">
            {navItems.map(({ label, icon: Icon, active, action }) => (
              <button
                key={label}
                onClick={action}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                  active
                    ? "bg-surface/[0.08] text-primary shadow-inner shadow-white/[0.02]"
                    : "text-muted hover:bg-surface/[0.04] hover:text-primary"
                }`}
              >
                <Icon size={17} />
                {label}
                {label === "Meetings" && (
                  <span className="ml-auto rounded-md bg-surface/[0.06] px-1.5 py-0.5 text-[9px] text-muted">{meetings.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-8 px-2 text-[9px] font-bold uppercase tracking-[0.2em] text-subtle">Tools</div>
          <nav className="mt-3 space-y-1">
            <button onClick={() => navigate("/new-meeting")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted transition hover:bg-surface/[0.04] hover:text-primary">
              <Mic2 size={17} />
              New recording
            </button>
            <button onClick={() => document.getElementById("meeting-search")?.focus()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted transition hover:bg-surface/[0.04] hover:text-primary">
              <Search size={17} />
              Search knowledge
            </button>
          </nav>

          <div className="mt-auto">
            <div className="mb-4 rounded-2xl border border-accent bg-gradient-to-br from-cyan-400/[0.08] to-violet-400/[0.05] p-4">
              <div className="flex items-center gap-2 text-accent">
                <Zap size={14} />
                <span className="text-[11px] font-bold">AI READY</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">
                Your workspace is ready to turn conversations into decisions.
              </p>
              <button onClick={() => navigate("/new-meeting")} className="mt-3 w-full rounded-lg bg-surface px-3 py-2 text-[11px] font-bold text-slate-950 transition hover:bg-cyan-50">
                Upload meeting
              </button>
            </div>

            <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-subtle transition hover:bg-rose-500/10 hover:text-rose-300">
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* mobile topbar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-theme bg-sidebar px-4 backdrop-blur-xl lg:hidden">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 text-muted hover:bg-surface/5">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-violet-500">
            <Sparkles size={15} />
          </div>
          MeetingAI
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            title={isLight ? "Dark mode" : "Light mode"}
            aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
            className="rounded-lg border border-theme bg-surface-2 p-2 text-muted"
          >
            {isLight ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button onClick={() => navigate("/new-meeting")} className="rounded-lg bg-accent-button p-2 text-accent-button-text">
            <Plus size={17} />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed left-0 right-0 top-16 z-20 border-b border-theme bg-sidebar p-4 lg:hidden">
          {navItems.map(({ label, icon: Icon, action }) => (
            <button key={label} onClick={action} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-secondary hover:bg-surface/5">
              <Icon size={17} />
              {label}
            </button>
          ))}
          <button onClick={() => navigate("/new-meeting")} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-secondary hover:bg-surface/5">
            <Plus size={17} />
            New recording
          </button>
          <button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-rose-300 hover:bg-rose-500/10">
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      )}

      <main className="relative lg:ml-[238px]">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-9 lg:py-7">
          {/* top nav */}
          <div className="flex items-center justify-between border-b border-theme pb-5">
            <div className="relative hidden w-[360px] md:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" size={16} />
              <input
                id="meeting-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search meetings, transcripts, action items..."
                className="h-10 w-full rounded-xl border border-theme bg-surface/[0.035] pl-10 pr-10 text-xs text-primary outline-none placeholder:text-subtle focus:border-cyan-400/30 focus:bg-surface/[0.05]"
              />
              {searching && <Activity className="absolute right-3 top-1/2 -translate-y-1/2 animate-pulse text-accent" size={14} />}
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-primary">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={refresh} className="hidden rounded-xl border border-theme bg-surface/[0.035] p-2.5 text-muted hover:text-primary sm:block">
                <Activity size={16} className={refreshing ? "animate-spin" : ""} />
              </button>
              <button
                onClick={toggleTheme}
                title={isLight ? "Switch to dark mode" : "Switch to light mode"}
                aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
                className="group relative rounded-xl border border-theme bg-surface-2 p-2.5 text-muted transition hover:text-primary"
              >
                {isLight ? <Moon size={16} /> : <Sun size={16} />}
                <span className="pointer-events-none absolute right-0 top-full mt-2 hidden whitespace-nowrap rounded-lg border border-theme bg-surface px-2.5 py-1.5 text-[10px] font-semibold text-primary shadow-lg group-hover:block">
                  {isLight ? "Dark mode" : "Light mode"}
                </span>
              </button>

              <button className="relative rounded-xl border border-theme bg-surface-2 p-2.5 text-muted transition hover:text-primary">
                <Bell size={16} />
                {processing.length > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />}
              </button>
              <div className="ml-2 hidden items-center gap-2 border-l border-theme pl-3 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-[11px] font-bold">
                  AI
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-primary">Workspace</p>
                  <p className="text-[9px] text-subtle">Personal</p>
                </div>
                <span className="mr-1 hidden text-[9px] font-semibold uppercase tracking-wider text-subtle md:block">{isLight ? "Light" : "Dark"}</span><ChevronDown size={13} className="text-subtle" />
              </div>
            </div>
          </div>

          {/* hero */}
          <section className="relative mt-7 overflow-hidden rounded-[28px] border border-theme hero-surface p-6 shadow-[0_25px_80px_rgba(0,0,0,.22)] sm:p-8 lg:p-9">
            <div className="pointer-events-none absolute -right-20 -top-32 h-[400px] w-[400px] rounded-full bg-accent-soft blur-[100px]" />
            <div className="pointer-events-none absolute right-[22%] bottom-[-180px] h-[350px] w-[350px] rounded-full bg-violet-500/[0.08] blur-[100px]" />

            <div className="relative flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent bg-cyan-300/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
                  AI workspace
                </div>
                <h1 className="mt-5 text-3xl font-bold tracking-[-0.035em] text-primary sm:text-4xl lg:text-[42px] lg:leading-[1.08]">
                  Make every meeting
                  <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-transparent">
                    worth remembering.
                  </span>
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
                  Capture the conversation. Understand what mattered. Leave with clear decisions and accountable next steps.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={() => navigate("/new-meeting")} className="group inline-flex items-center gap-2 rounded-xl bg-accent-button px-4 py-2.5 text-xs font-bold text-accent-button-text shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-cyan-50">
                    <Plus size={16} />
                    New meeting
                    <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                  </button>
                  <button onClick={() => document.getElementById("meetings")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl border border-theme bg-surface/[0.04] px-4 py-2.5 text-xs font-semibold text-secondary transition hover:bg-surface/[0.08]">
                    View library
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[500px]">
                <Metric icon={FileText} label="Meetings" value={meetings.length} />
                <Metric icon={CheckCircle2} label="Completed" value={completed.length} />
                <Metric icon={Target} label="Avg score" value={avgScore !== null ? `${avgScore}` : "—"} />
                <Metric icon={Clock3} label="Processing" value={processing.length} />
              </div>
            </div>
          </section>

          {/* analytics strip */}
          <section id="analytics" className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-theme bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">Meeting health</p>
                  <p className="mt-1 text-sm font-semibold text-primary">Effectiveness</p>
                </div>
                <BarChart3 size={18} className="text-subtle" />
              </div>
              <div className="mt-5 flex items-center gap-5">
                <ScoreRing score={avgScore} />
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {avgScore === null ? "Build your first baseline" : avgScore >= 85 ? "Strong meeting quality" : avgScore >= 70 ? "Healthy performance" : "Room to improve"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Based on completed meeting intelligence.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-theme bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">Knowledge captured</p>
                  <p className="mt-1 text-sm font-semibold text-primary">Transcript volume</p>
                </div>
                <FileText size={18} className="text-subtle" />
              </div>
              <div className="mt-6">
                <p className="text-3xl font-bold tracking-tight text-primary">{words.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted">words analyzed across completed meetings</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface/[0.06]">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-theme bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">Workspace status</p>
                  <p className="mt-1 text-sm font-semibold text-primary">AI pipeline</p>
                </div>
                <Activity size={18} className="text-accent" />
              </div>
              <div className="mt-5 flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                  <Check size={18} />
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">All systems operational</p>
                  <p className="text-xs text-muted">Transcription · AI · analytics</p>
                </div>
              </div>
            </div>
          </section>

          {/* processing */}
          {processing.length > 0 && (
            <section className="mt-6 rounded-2xl border border-accent bg-accent-softer p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-accent">
                    <Activity size={18} className="animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">AI processing in progress</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {processing.length} meeting{processing.length > 1 ? "s" : ""} currently being analyzed.
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                  Live
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {processing.slice(0, 2).map((meeting) => (
                  <div key={meeting.id} className="rounded-xl border border-theme bg-surface-2 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="truncate text-xs font-semibold text-secondary">{meeting.title || meeting.file_name}</p>
                      <span className="text-[10px] text-subtle">{meeting.status}</span>
                    </div>
                    <MeetingProcessingBar meeting={meeting} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* library */}
          <section id="meetings" className="mt-9">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">Your workspace</p>
                <div className="mt-1 flex items-center gap-3">
                  <h2 className="text-xl font-bold tracking-tight text-primary">Recent meetings</h2>
                  <span className="rounded-full border border-theme bg-surface/[0.035] px-2 py-0.5 text-[10px] font-bold text-muted">{visibleMeetings.length}</span>
                </div>
              </div>

              <button
                onClick={() => setSortNewest((v) => !v)}
                className="inline-flex w-fit items-center gap-2 rounded-xl border border-theme bg-surface/[0.035] px-3 py-2 text-[11px] font-semibold text-muted hover:text-primary"
              >
                <ArrowDown size={14} />
                {sortNewest ? "Newest first" : "Oldest first"}
              </button>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-48 animate-pulse rounded-2xl border border-theme bg-surface/[0.025]" />
                  ))}
                </div>
              ) : pageMeetings.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-theme bg-surface/[0.02] px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface/[0.05] text-muted">
                    <FolderOpen size={24} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-primary">{query ? "No matching meetings" : "Your library is empty"}</h3>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-subtle">
                    {query ? "Try another search phrase." : "Upload your first meeting and let the AI build your workspace."}
                  </p>
                  {!query && (
                    <button onClick={() => navigate("/new-meeting")} className="mt-5 rounded-xl bg-accent-button px-4 py-2.5 text-xs font-bold text-accent-button-text">
                      Upload meeting
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {pageMeetings.map((meeting) => {
                    const score = Number(meeting.effectiveness_score);
                    const hasScore = Number.isFinite(score);

                    return (
                      <article
                        key={meeting.id}
                        onClick={() => navigate(`/meetings/${meeting.id}`)}
                        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-theme bg-card transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-card-hover hover:shadow-[0_20px_55px_rgba(0,0,0,.22)]"
                      >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent opacity-0 transition group-hover:opacity-100" />

                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/[0.09] to-white/[0.03] text-muted ring-1 ring-white/[0.05] transition group-hover:text-accent">
                                <FileAudio size={17} />
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate text-[13px] font-bold text-primary">{meeting.title || meeting.file_name || `Meeting ${meeting.id}`}</h3>
                                <p className="mt-1 truncate text-[10px] text-subtle">{meeting.file_name || "Meeting recording"}</p>
                              </div>
                            </div>
                            <MoreHorizontal size={17} className="shrink-0 text-subtle" />
                          </div>

                          <div className="mt-5 flex items-center justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-subtle">
                                <span className="flex items-center gap-1"><CalendarDays size={12} />{dateLabel(meeting.created_at)}</span>
                                {meeting.duration && <span className="flex items-center gap-1"><Clock3 size={12} />{durationLabel(meeting.duration)}</span>}
                                {meeting.speaker_count && <span className="flex items-center gap-1"><Users size={12} />{meeting.speaker_count}</span>}
                              </div>
                              <div className="mt-3">
                                <MeetingStatusBadge status={meeting.status} />
                              </div>
                            </div>

                            <ScoreRing score={hasScore ? score : null} />
                          </div>

                          {meeting.summary ? (
                            <p className="mt-5 line-clamp-2 text-xs leading-5 text-muted">{meeting.summary}</p>
                          ) : (
                            <p className="mt-5 flex items-center gap-1.5 text-[11px] text-subtle">
                              <Sparkles size={13} />
                              {PROCESSING.includes(meeting.status) ? "AI is analyzing this meeting..." : "No summary available yet."}
                            </p>
                          )}

                          {PROCESSING.includes(meeting.status) && (
                            <div onClick={(event) => event.stopPropagation()} className="mt-4">
                              <MeetingProcessingBar meeting={meeting} />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-theme bg-surface/[0.015] px-5 py-3">
                          <span className="text-[10px] font-medium text-subtle">{meeting.effectiveness_rating || "Meeting intelligence"}</span>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-subtle transition group-hover:text-accent">
                            Open meeting <ArrowRight size={12} />
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    disabled={safePage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border border-theme bg-surface/[0.03] p-2 text-muted disabled:opacity-30 hover:text-primary"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="rounded-xl bg-surface/[0.08] px-3 py-2 text-[11px] font-bold text-primary">{safePage}</span>
                  <span className="text-[11px] text-subtle">of {totalPages}</span>
                  <button
                    disabled={safePage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-xl border border-theme bg-surface/[0.03] p-2 text-muted disabled:opacity-30 hover:text-primary"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </section>

          <footer className="mt-12 border-t border-theme py-6 text-center text-[10px] text-subtle">
            MeetingAI · Private meeting intelligence workspace
          </footer>
        </div>
      </main>
    </div>
  );
}



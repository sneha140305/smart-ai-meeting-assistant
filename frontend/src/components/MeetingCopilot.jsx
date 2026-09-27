import { useState } from "react";
import api from "../services/api";


export default function MeetingCopilot({
  meetingId,
  onJumpToTimestamp
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const suggestedQuestions = [
    "What were the main decisions?",
    "What action items were assigned?",
    "What issues are still unresolved?",
    "Summarize the key discussion points."
  ];


  const askQuestion = async (event) => {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setAnswer("");
      setSources([]);

      const response = await api.post(
        `/meetings/${meetingId}/ask`,
        {
          question: trimmedQuestion
        }
      );

      setAnswer(
        response.data.answer || ""
      );

      setSources(
        response.data.sources || []
      );

    } catch (error) {
      console.error(
        "Meeting Copilot error:",
        error
      );

      setError(
        error.response?.data?.detail ||
        "Unable to get an answer. Please try again."
      );

    } finally {
      setLoading(false);
    }
  };


  const handleSuggestion = (suggestion) => {
    setQuestion(suggestion);
  };


  const handleSourceClick = (source) => {
    if (
      typeof onJumpToTimestamp === "function" &&
      source?.start !== undefined
    ) {
      onJumpToTimestamp(
        Number(source.start)
      );
    }
  };


  const formatTimestamp = (seconds) => {
    if (
      seconds === null ||
      seconds === undefined ||
      Number.isNaN(Number(seconds))
    ) {
      return "--:--";
    }

    const totalSeconds = Math.max(
      0,
      Math.floor(Number(seconds))
    );

    const minutes = Math.floor(
      totalSeconds / 60
    );

    const remainingSeconds =
      totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };


  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

      {/* Header */}

      <div className="mb-5">

        <div className="flex items-center gap-2">

          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-lg">
            ✨
          </div>

          <div>

            <h2 className="text-lg font-semibold text-gray-900">
              AI Meeting Copilot
            </h2>

            <p className="text-sm text-gray-500">
              Ask questions about this meeting.
            </p>

          </div>

        </div>

      </div>


      {/* Suggested Questions */}

      <div className="mb-5">

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Suggested questions
        </p>

        <div className="flex flex-wrap gap-2">

          {suggestedQuestions.map(
            (suggestion) => (

              <button
                key={suggestion}
                type="button"
                onClick={() =>
                  handleSuggestion(
                    suggestion
                  )
                }
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                {suggestion}
              </button>

            )
          )}

        </div>

      </div>


      {/* Question Form */}

      <form
        onSubmit={askQuestion}
        className="flex flex-col gap-2 sm:flex-row"
      >

        <input
          type="text"
          value={question}
          onChange={(event) =>
            setQuestion(event.target.value)
          }
          placeholder="Ask something about this meeting..."
          maxLength={1000}
          disabled={loading}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
        />

        <button
          type="submit"
          disabled={
            loading ||
            !question.trim()
          }
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Thinking..."
            : "Ask"}
        </button>

      </form>


      {/* Character Counter */}

      <div className="mt-1 text-right text-xs text-gray-400">
        {question.length}/1000
      </div>


      {/* Error */}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">

          <div className="flex items-start gap-2">

            <span className="text-red-500">
              ⚠
            </span>

            <p className="text-sm text-red-600">
              {error}
            </p>

          </div>

        </div>
      )}


      {/* Loading */}

      {loading && (
        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">

          <div className="flex items-center gap-3">

            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />

            <div>

              <p className="text-sm font-medium text-blue-700">
                Analyzing the meeting...
              </p>

              <p className="mt-0.5 text-xs text-blue-600">
                Searching relevant transcript sections
              </p>

            </div>

          </div>

        </div>
      )}


      {/* AI Answer */}

      {answer && !loading && (
        <div className="mt-5">

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">

            <div className="mb-3 flex items-center gap-2">

              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-sm">
                AI
              </div>

              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                AI Answer
              </span>

            </div>

            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
              {answer}
            </p>

          </div>


          {/* Sources */}

          {sources.length > 0 && (
            <div className="mt-5">

              <div className="mb-3">

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Sources from meeting
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Click a source to jump to that point in the meeting.
                </p>

              </div>


              <div className="space-y-2">

                {sources.map(
                  (source, index) => (

                    <button
                      key={`${source.start}-${source.end}-${index}`}
                      type="button"
                      onClick={() =>
                        handleSourceClick(
                          source
                        )
                      }
                      className="group block w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                    >

                      <div className="flex items-center justify-between gap-3">

                        <div className="flex items-center gap-2">

                          <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                            {formatTimestamp(
                              source.start
                            )}
                          </span>

                          <span className="text-xs text-gray-400">
                            →
                          </span>

                          <span className="text-xs font-medium text-gray-500">
                            {formatTimestamp(
                              source.end
                            )}
                          </span>

                        </div>


                        <span className="text-xs text-gray-400 transition group-hover:text-blue-600">
                          Jump to audio →
                        </span>

                      </div>


                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-gray-600">
                        {source.text}
                      </p>

                    </button>

                  )
                )}

              </div>

            </div>
          )}

        </div>
      )}


      {/* Empty State */}

      {!answer &&
        !loading &&
        !error && (
          <div className="mt-6 rounded-lg border border-dashed border-gray-200 p-6 text-center">

            <div className="mb-2 text-2xl">
              💬
            </div>

            <p className="text-sm font-medium text-gray-700">
              Ask your meeting anything
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Answers are grounded in the transcript of this meeting.
            </p>

          </div>
        )}

    </div>
  );
}
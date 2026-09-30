import { useState } from "react";
import api from "../services/api";


export default function KnowledgeSearch() {

  const [question, setQuestion] = useState("");

  const [answer, setAnswer] = useState("");

  const [sources, setSources] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");


  const searchKnowledge = async (event) => {

    event.preventDefault();

    if (!question.trim()) {
      return;
    }

    try {

      setLoading(true);
      setError("");
      setAnswer("");
      setSources([]);

      const response = await api.post(
        "/meetings/knowledge-search",
        {
          question: question.trim()
        }
      );

      setAnswer(response.data.answer);

      setSources(
        response.data.sources || []
      );

    } catch (error) {

      setError(
        error.response?.data?.detail ||
        "Knowledge search failed."
      );

    } finally {

      setLoading(false);

    }
  };


  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

      <div className="mb-5">

        <h2 className="text-lg font-semibold text-gray-900">
          Meeting Knowledge
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Ask questions across all your meetings.
        </p>

      </div>


      <form
        onSubmit={searchKnowledge}
        className="flex gap-2"
      >

        <input
          value={question}
          onChange={(event) =>
            setQuestion(event.target.value)
          }
          placeholder="Ask about any past meeting..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <button
          type="submit"
          disabled={
            loading ||
            !question.trim()
          }
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading
            ? "Searching..."
            : "Ask"}
        </button>

      </form>


      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}


      {answer && (
        <div className="mt-5 rounded-lg bg-gray-50 p-5">

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            AI Answer
          </p>

          <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
            {answer}
          </p>

        </div>
      )}


      {sources.length > 0 && (
        <div className="mt-5">

          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Sources
          </p>

          <div className="space-y-2">

            {sources.map(
              (source, index) => (

                <div
                  key={index}
                  className="rounded-lg border border-gray-200 p-3"
                >

                  <div className="flex justify-between">

                    <p className="text-sm font-medium text-gray-800">
                      {source.meeting_title}
                    </p>

                    <span className="text-xs text-blue-600">
                      {Math.floor(
                        source.start / 60
                      )}:
                      {String(
                        Math.floor(
                          source.start % 60
                        )
                      ).padStart(2, "0")}
                    </span>

                  </div>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {source.text}
                  </p>

                </div>

              )
            )}

          </div>

        </div>
      )}

    </div>
  );
}
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileAudio, ArrowLeft, Loader2 } from "lucide-react";
import api from "../services/api";

function NewMeeting() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!title.trim()) {
      setError("Please enter a meeting title.");
      return;
    }

    if (!file) {
      setError("Please select an audio or video file.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);

    try {
      setLoading(true);

      await api.post("/meetings/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Failed to upload meeting. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="max-w-3xl mx-auto px-6 py-10">

        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">
              New Meeting
            </h1>

            <p className="text-slate-500 mt-2">
              Upload your meeting recording and let AI analyze it.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Meeting Title */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Meeting Title
              </label>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Product Team Weekly Meeting"
                className="w-full px-4 py-3 rounded-xl border border-slate-300
                focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* File Upload */}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Meeting Recording
              </label>

              <label
                className="flex flex-col items-center justify-center
                w-full h-56 border-2 border-dashed border-slate-300
                rounded-2xl cursor-pointer hover:border-indigo-400
                hover:bg-indigo-50/30 transition"
              >

                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.mp4,.webm,.mov"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files[0])}
                />

                {file ? (
                  <>
                    <FileAudio
                      size={42}
                      className="text-indigo-600 mb-3"
                    />

                    <p className="font-medium text-slate-800">
                      {file.name}
                    </p>

                    <p className="text-sm text-slate-500 mt-1">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload
                      size={42}
                      className="text-slate-400 mb-3"
                    />

                    <p className="font-medium text-slate-700">
                      Click to upload
                    </p>

                    <p className="text-sm text-slate-500 mt-2">
                      MP3, WAV, M4A, MP4, WEBM or MOV
                    </p>

                    <p className="text-xs text-slate-400 mt-1">
                      Maximum file size: 500 MB
                    </p>
                  </>
                )}

              </label>
            </div>

            {/* Error */}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700
              rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2
              bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
              text-white font-semibold py-3 rounded-xl transition"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload Meeting
                </>
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}

export default NewMeeting;
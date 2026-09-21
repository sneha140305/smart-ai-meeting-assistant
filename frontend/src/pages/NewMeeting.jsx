import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileAudio,
  FileVideo,
  X,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import api from "../services/api";

export default function NewMeeting() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const allowedTypes = [
    ".mp3",
    ".wav",
    ".m4a",
    ".mp4",
    ".webm",
    ".mov",
  ];

  const maxFileSize = 500 * 1024 * 1024; // 500 MB

  const validateFile = (selectedFile) => {
    if (!selectedFile) {
      return "Please select a file.";
    }

    const fileName = selectedFile.name.toLowerCase();

    const isValidType = allowedTypes.some((type) =>
      fileName.endsWith(type)
    );

    if (!isValidType) {
      return "Invalid file type. Please upload MP3, WAV, M4A, MP4, WEBM, or MOV.";
    }

    if (selectedFile.size > maxFileSize) {
      return "File size must be less than 500 MB.";
    }

    return "";
  };

  const handleFileSelect = (selectedFile) => {
    setError("");

    const validationError = validateFile(selectedFile);

    if (validationError) {
      setError(validationError);
      return;
    }

    setFile(selectedFile);

    // Automatically use filename as title if title is empty
    if (!title.trim()) {
      const fileNameWithoutExtension =
        selectedFile.name.replace(/\.[^/.]+$/, "");

      setTitle(fileNameWithoutExtension);
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];

    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError("");
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getFileIcon = () => {
    if (!file) {
      return <Upload size={32} />;
    }

    const videoExtensions = [".mp4", ".webm", ".mov"];

    const isVideo = videoExtensions.some((extension) =>
      file.name.toLowerCase().endsWith(extension)
    );

    return isVideo ? (
      <FileVideo size={32} />
    ) : (
      <FileAudio size={32} />
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!title.trim()) {
      setError("Please enter a meeting title.");
      return;
    }

    if (!file) {
      setError("Please select an audio or video file.");
      return;
    }

    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setUploading(true);

      // -----------------------------------------
      // STEP 1: Upload meeting
      // -----------------------------------------

      const formData = new FormData();

      formData.append("title", title.trim());
      formData.append("file", file);

      const uploadResponse = await api.post(
        "/meetings/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const meetingId = uploadResponse.data.id;

      if (!meetingId) {
        throw new Error(
          "Meeting was uploaded but no meeting ID was returned."
        );
      }

      // -----------------------------------------
      // STEP 2: Start automatic AI processing
      // -----------------------------------------

      await api.post(
        `/meetings/${meetingId}/process`
      );

      // -----------------------------------------
      // STEP 3: Open meeting processing page
      // -----------------------------------------

      navigate(`/meetings/${meetingId}`);

    } catch (err) {
      console.error(
        "Meeting upload/processing error:",
        err
      );

      let errorMessage =
        "Something went wrong while uploading the meeting.";

      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-4">

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mr-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            disabled={uploading}
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              New Meeting
            </h1>

            <p className="text-sm text-gray-500">
              Upload a meeting and let AI analyze it automatically
            </p>
          </div>

        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-3xl px-6 py-10">

        {/* Intro */}
        <div className="mb-8">

          <h2 className="text-2xl font-bold text-gray-900">
            Upload your meeting
          </h2>

          <p className="mt-2 text-gray-600">
            Upload an audio or video recording. The AI will
            automatically transcribe, identify speakers, analyze
            the discussion, and generate meeting insights.
          </p>

        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* Meeting title */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">

            <label
              htmlFor="meeting-title"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Meeting Title
            </label>

            <input
              id="meeting-title"
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="e.g. Weekly Product Meeting"
              disabled={uploading}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
            />

          </div>

          {/* File upload */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">

            <label className="mb-3 block text-sm font-medium text-gray-700">
              Meeting Recording
            </label>

            {!file ? (

              <label
                htmlFor="meeting-file"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                }`}
              >

                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Upload size={30} />
                </div>

                <p className="text-base font-medium text-gray-900">
                  Drop your meeting file here
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  or click to browse
                </p>

                <p className="mt-4 text-xs text-gray-400">
                  MP3, WAV, M4A, MP4, WEBM, MOV · Maximum 500 MB
                </p>

                <input
                  id="meeting-file"
                  type="file"
                  accept=".mp3,.wav,.m4a,.mp4,.webm,.mov"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                />

              </label>

            ) : (

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">

                <div className="flex items-center justify-between">

                  <div className="flex min-w-0 items-center gap-4">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                      {getFileIcon()}
                    </div>

                    <div className="min-w-0">

                      <p className="truncate text-sm font-medium text-gray-900">
                        {file.name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>

                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={uploading}
                    className="ml-4 rounded-lg p-2 text-gray-500 transition hover:bg-white hover:text-red-600 disabled:cursor-not-allowed"
                  >
                    <X size={18} />
                  </button>

                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-green-600">

                  <CheckCircle size={15} />

                  File ready for upload

                </div>

              </div>

            )}

          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">

              <AlertCircle
                size={20}
                className="mt-0.5 shrink-0 text-red-600"
              />

              <div>
                <p className="text-sm font-medium text-red-800">
                  Upload failed
                </p>

                <p className="mt-1 text-sm text-red-600">
                  {error}
                </p>
              </div>

            </div>
          )}

          {/* Processing information */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">

            <h3 className="font-semibold text-blue-900">
              What happens after upload?
            </h3>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">

              <div className="flex items-center gap-3 text-sm text-blue-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                  🎙️
                </div>
                Speech transcription
              </div>

              <div className="flex items-center gap-3 text-sm text-blue-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                  👥
                </div>
                Speaker identification
              </div>

              <div className="flex items-center gap-3 text-sm text-blue-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                  🧠
                </div>
                AI meeting analysis
              </div>

              <div className="flex items-center gap-3 text-sm text-blue-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                  📊
                </div>
                Insights & action items
              </div>

            </div>

          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              disabled={uploading}
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                uploading ||
                !title.trim() ||
                !file
              }
              className="flex min-w-[170px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {uploading ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />

                  Starting AI Processing...
                </>
              ) : (
                <>
                  <Upload size={18} />

                  Upload & Process
                </>
              )}

            </button>

          </div>

        </form>

      </main>

    </div>
  );
}
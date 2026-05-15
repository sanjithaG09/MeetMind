"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileAudio, X } from "lucide-react";
import { uploadMeeting } from "@/lib/api";
import { cn } from "@/lib/utils";

const ACCEPTED = ".mp3,.wav,.mp4,.m4a,.webm";
const MAX_MB = 25;

export function MeetingUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function pickFile(f: File) {
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_MB}MB limit.`);
      return;
    }
    setError("");
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) pickFile(dropped);
  }, [title]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { meeting_id } = await uploadMeeting(file, title || undefined);
      router.push(`/meetings/${meeting_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
      setUploading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer",
          dragging
            ? "border-gray-900 bg-gray-50"
            : file
            ? "border-gray-200 bg-gray-50 cursor-default"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileAudio className="w-8 h-8 text-gray-600 shrink-0" />
            <div className="text-left">
              <p className="font-medium text-gray-900 text-sm">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setTitle(""); }}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <UploadCloud className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Drop your meeting file here</p>
            <p className="text-sm text-gray-400 mt-1">or click to browse</p>
            <p className="text-xs text-gray-400 mt-3">MP3 · WAV · MP4 · up to 25 MB</p>
          </>
        )}
      </div>

      {/* Title input */}
      {file && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title (optional)"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {file && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {uploading ? "Uploading..." : "Analyze Meeting"}
        </button>
      )}
    </div>
  );
}

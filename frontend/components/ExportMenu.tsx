"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileText, FileSpreadsheet, File } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  meetingId: string;
}

const OPTIONS = [
  { id: "pdf",      label: "PDF Summary", description: "Full report — decisions, topics, actions", icon: File,            color: "text-gray-600" },
  { id: "markdown", label: "Markdown",    description: "Formatted summary for Notion, GitHub",     icon: FileText,        color: "text-gray-600" },
  { id: "csv",      label: "CSV Actions", description: "Action items table for spreadsheets",      icon: FileSpreadsheet, color: "text-gray-600" },
] as const;

type ExportType = (typeof OPTIONS)[number]["id"];

export function ExportMenu({ meetingId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportType | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleExport(type: ExportType) {
    setOpen(false);
    setLoading(type);
    try {
      const res = await fetch(`${API}/api/meetings/${meetingId}/export/${type}`);
      if (!res.ok) throw new Error("Export failed");
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `meeting_export.${type === "pdf" ? "pdf" : type === "markdown" ? "md" : "csv"}`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setLoading(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
          {OPTIONS.map(({ id, label, description, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => handleExport(id)}
              disabled={loading !== null}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
            >
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color}`} />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {label}
                  {loading === id && <span className="ml-1.5 text-xs text-gray-400 animate-pulse">downloading…</span>}
                </p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

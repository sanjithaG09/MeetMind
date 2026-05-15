"use client";

import Link from "next/link";
import { Calendar, Clock, CheckCircle, AlertCircle, Loader2, Trash2, CheckCircle2, ListTodo } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Meeting } from "@/lib/types";

interface Props {
  meeting: Meeting;
  onDelete?: (id: string) => void;
}

export function MeetingCard({ meeting, onDelete }: Props) {
  const isProcessing = meeting.status === "processing" || meeting.status === "pending";

  return (
    <div
      className={`p-5 bg-white border border-gray-200 rounded-lg transition-all ${
        meeting.status === "completed"
          ? "hover:border-gray-900 hover:shadow-md"
          : "opacity-70"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {meeting.status === "completed" ? (
            <Link href={`/meetings/${meeting.id}`}>
              <h4 className="hover:text-gray-600 transition-colors truncate">{meeting.title}</h4>
            </Link>
          ) : (
            <h4 className="truncate">{meeting.title}</h4>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {formatDate(meeting.created_at)}
            </span>
            {meeting.duration_seconds && (
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {formatDuration(meeting.duration_seconds)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {meeting.status === "completed" && (
            <span className="flex items-center gap-1.5 px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
              <CheckCircle size={12} />
              Completed
            </span>
          )}
          {isProcessing && (
            <span className="flex items-center gap-1.5 px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full">
              <Loader2 size={12} className="animate-spin" />
              Processing
            </span>
          )}
          {meeting.status === "failed" && (
            <span className="flex items-center gap-1.5 px-3 py-1 text-xs bg-red-50 text-red-700 rounded-full">
              <AlertCircle size={12} />
              Failed
            </span>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(meeting.id)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {meeting.status === "completed" && (
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 size={14} className="text-green-500" />
            {meeting.resolved_count} resolved
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock size={14} className="text-amber-500" />
            {meeting.pending_count} pending
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <ListTodo size={14} className="text-gray-400" />
            {meeting.action_items_count} actions
          </span>
        </div>
      )}
      {isProcessing && (
        <p className="text-sm text-blue-600 mt-2">Transcribing and analyzing...</p>
      )}
      {meeting.status === "failed" && (
        <p className="text-sm text-red-600 mt-2">Processing failed.</p>
      )}
    </div>
  );
}

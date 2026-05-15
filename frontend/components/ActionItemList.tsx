"use client";

import { Check, Circle, Calendar, User, Mic } from "lucide-react";
import type { ActionItem, ActionStatus } from "@/lib/types";

interface Props {
  items: ActionItem[];
  onToggle: (item: ActionItem) => void;
  getRecordingLabel?: (index: number) => string | undefined;
}

export function ActionItemList({ items, onToggle, getRecordingLabel }: Props) {
  if (!items.length) {
    return <p className="text-sm text-gray-500 italic">No action items identified.</p>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 py-3">
          <button
            onClick={() => onToggle(item)}
            className="shrink-0 mt-0.5 text-gray-400 hover:text-gray-900 transition-colors"
          >
            {item.status === "completed" ? (
              <Check className="w-5 h-5 text-green-500" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium ${
                item.status === "completed"
                  ? "line-through text-gray-400"
                  : "text-gray-900"
              }`}
            >
              {item.task}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {item.assignee}
              </span>
              {item.priority && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                  item.priority === "high"
                    ? "bg-red-100 text-red-700"
                    : item.priority === "medium"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                </span>
              )}
              {item.deadline && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {item.deadline}
                </span>
              )}
              {item.topic_title && (
                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                  {item.topic_title}
                </span>
              )}
              {getRecordingLabel && item.recording_index != null && item.recording_index > 0 && (
                <span className="flex items-center gap-1 text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                  <Mic className="w-2.5 h-2.5" />
                  {getRecordingLabel(item.recording_index)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

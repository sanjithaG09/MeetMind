import { CheckCircle2, Clock, AlertCircle, ArrowRight, Mic } from "lucide-react";
import type { Topic } from "@/lib/types";

export function TopicCard({ topic, recordingLabel }: { topic: Topic; recordingLabel?: string }) {
  const resolved = topic.status === "resolved";

  return (
    <div
      className={`rounded-xl border p-5 ${
        resolved
          ? "bg-green-50 border-green-200"
          : "bg-amber-50 border-amber-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {resolved ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <Clock className="w-5 h-5 text-amber-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{topic.title}</h3>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                resolved
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {resolved ? "Resolved" : "Pending"}
            </span>
            {recordingLabel && (
              <span className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                <Mic className="w-2.5 h-2.5" />
                {recordingLabel}
              </span>
            )}
          </div>

          {topic.summary && (
            <p className="text-sm text-gray-600 mt-1">{topic.summary}</p>
          )}

          {resolved && (
            <div className="mt-3 space-y-1.5">
              {topic.decision && (
                <div className="flex gap-2 text-sm">
                  <span className="font-medium text-gray-700 shrink-0">Decision:</span>
                  <span className="text-gray-800">{topic.decision}</span>
                </div>
              )}
              {topic.reason && (
                <div className="flex gap-2 text-sm">
                  <span className="font-medium text-gray-700 shrink-0">Reason:</span>
                  <span className="text-gray-600">{topic.reason}</span>
                </div>
              )}
            </div>
          )}

          {!resolved && (
            <div className="mt-3 space-y-1.5">
              {topic.stopped_at && (
                <div className="flex gap-2 text-sm">
                  <span className="font-medium text-gray-700 shrink-0">Stopped at:</span>
                  <span className="text-gray-600">{topic.stopped_at}</span>
                </div>
              )}
              {topic.blocker && (
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="text-gray-700">
                    <span className="font-medium">Blocker:</span> {topic.blocker}
                  </span>
                </div>
              )}
              {topic.next_step && (
                <div className="flex items-start gap-2 text-sm">
                  <ArrowRight className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  <span className="text-gray-700">
                    <span className="font-medium">Next step:</span> {topic.next_step}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

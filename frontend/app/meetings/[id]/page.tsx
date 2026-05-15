"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, CheckCircle2, Clock, ListTodo, AlertTriangle,
  PlusCircle, BrainCircuit, FileText, BarChart3, Upload, Mic, Sparkles, CircleDot,
} from "lucide-react";
import { getMeeting, appendAudio, updateActionItem, reanalyzeMeeting } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { TopicCard } from "@/components/TopicCard";
import { ActionItemList } from "@/components/ActionItemList";
import { TranscriptPlayer } from "@/components/TranscriptPlayer";
import { ExportMenu } from "@/components/ExportMenu";
import { formatDate, formatDuration } from "@/lib/utils";
import type { MeetingDetail, ProcessingStep, ActionStatus, ActionItem } from "@/lib/types";

type Tab = "overview" | "topics" | "actions" | "transcript";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview",   label: "Overview",     icon: BarChart3 },
  { id: "topics",     label: "Topics",       icon: BrainCircuit },
  { id: "actions",    label: "Action Items", icon: ListTodo },
  { id: "transcript", label: "Transcript",   icon: FileText },
];

const STEPS: { id: ProcessingStep | "uploaded" | "completed"; label: string; sublabel: string; icon: React.ElementType }[] = [
  { id: "uploaded",     label: "File uploaded",           sublabel: "Ready to process",          icon: Upload },
  { id: "transcribing", label: "Transcribing audio",       sublabel: "Converting speech to text", icon: Mic },
  { id: "analyzing",    label: "Extracting intelligence",  sublabel: "Analyzing with AI",         icon: Sparkles },
  { id: "completed",    label: "Complete",                 sublabel: "Results ready",             icon: CheckCircle2 },
];

function stepIndex(step: ProcessingStep | "uploaded" | "completed" | "failed"): number {
  if (step === "uploaded") return 0;
  if (step === "transcribing") return 1;
  if (step === "analyzing") return 2;
  return 3;
}

function ProcessingSteps({ current }: { current: ProcessingStep }) {
  const activeIdx = stepIndex(current ?? "uploaded");
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
        <p className="font-semibold text-gray-900">Analyzing your meeting</p>
      </div>
      <ol className="space-y-3">
        {STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          const Icon = step.icon;
          return (
            <li key={step.id} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                done ? "bg-gray-200" : active ? "bg-gray-900" : "bg-gray-100"
              }`}>
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-gray-700" />
                ) : active ? (
                  <CircleDot className="w-4 h-4 text-white animate-pulse" />
                ) : (
                  <Icon className="w-4 h-4 text-gray-300" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${
                  done ? "text-gray-700" : active ? "text-gray-900" : "text-gray-400"
                }`}>
                  {step.label}
                  {active && <span className="ml-1.5 text-gray-400 animate-pulse">•••</span>}
                </p>
                {active && <p className="text-xs text-gray-400 mt-0.5">{step.sublabel}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws");

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [liveStep, setLiveStep] = useState<ProcessingStep>(null);
  const [appending, setAppending] = useState(false);
  const [appendError, setAppendError] = useState("");
  const [reanalyzing, setReanalyzing] = useState(false);
  const [actionOverrides, setActionOverrides] = useState<Record<string, ActionStatus>>({});
  const appendInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchMeeting = useCallback(async () => {
    try {
      const data = await getMeeting(id);
      setMeeting(data);
      setLiveStep(data.processing_step ?? null);
      return data;
    } catch {
      setError("Meeting not found or failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const openWebSocket = useCallback(() => {
    if (wsRef.current) return;
    const ws = new WebSocket(`${WS_BASE}/ws/meetings/${id}`);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as { step: string };
      if (msg.step === "transcribing" || msg.step === "analyzing") {
        setLiveStep(msg.step);
      } else if (msg.step === "completed" || msg.step === "failed") {
        fetchMeeting();
        ws.close();
        wsRef.current = null;
      }
    };
    ws.onerror = () => {
      ws.close();
      wsRef.current = null;
      const poll = () => {
        fallbackRef.current = setTimeout(async () => {
          const data = await fetchMeeting();
          if (data && (data.status === "processing" || data.status === "pending")) poll();
        }, 8000);
      };
      poll();
    };
    ws.onclose = () => { wsRef.current = null; };
  }, [id, fetchMeeting]);

  useEffect(() => {
    fetchMeeting().then((data) => {
      if (data && (data.status === "processing" || data.status === "pending")) openWebSocket();
    });
    return () => { wsRef.current?.close(); wsRef.current = null; clearTimeout(fallbackRef.current); };
  }, [fetchMeeting, openWebSocket]);

  useEffect(() => {
    if (meeting && (meeting.status === "processing" || meeting.status === "pending")) openWebSocket();
  }, [meeting?.status, openWebSocket]);

  async function handleAppend(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAppending(true);
    setAppendError("");
    try {
      await appendAudio(id, file);
      setMeeting((m) => (m ? { ...m, status: "processing" } : m));
      setLiveStep(null);
    } catch (err: unknown) {
      setAppendError(err instanceof Error ? err.message : "Failed to append audio.");
    } finally {
      setAppending(false);
      if (appendInputRef.current) appendInputRef.current.value = "";
    }
  }

  async function handleReanalyze() {
    setReanalyzing(true);
    try {
      await reanalyzeMeeting(id);
      setMeeting((m) => (m ? { ...m, status: "processing" } : m));
      setLiveStep(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Reanalysis failed.");
    } finally {
      setReanalyzing(false);
    }
  }

  const displayItems = useMemo<ActionItem[]>(
    () => (meeting?.action_items ?? []).map((a) => ({
      ...a,
      status: (actionOverrides[a.id] ?? a.status) as ActionStatus,
    })),
    [meeting?.action_items, actionOverrides],
  );

  async function handleToggle(item: ActionItem) {
    const current = (actionOverrides[item.id] ?? item.status) as ActionStatus;
    const next: ActionStatus = current === "completed" ? "pending" : "completed";
    setActionOverrides((prev) => ({ ...prev, [item.id]: next }));
    try {
      await updateActionItem(meeting!.id, item.id, next);
    } catch {
      setActionOverrides((prev) => ({ ...prev, [item.id]: current }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">{error || "Meeting not found."}</p>
        <Link href="/dashboard" className="text-gray-900 underline text-sm mt-4 inline-block">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const isProcessing = meeting.status === "processing" || meeting.status === "pending";
  const resolvedTopics = meeting.topics.filter((t) => t.status === "resolved");
  const pendingTopics = meeting.topics.filter((t) => t.status === "pending");
  const completedActions = displayItems.filter((a) => a.status === "completed").length;

  function getRecordingLabel(index: number): string | undefined {
    if (index === 0) return undefined;
    const extra = meeting!.extra_audio_files?.[index - 1];
    const datePart = extra?.uploaded_at
      ? new Date(extra.uploaded_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "";
    return `Recording ${index + 1}${datePart ? ` · ${datePart}` : ""}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Dashboard
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(meeting.created_at)}
            {meeting.duration_seconds ? ` · ${formatDuration(meeting.duration_seconds)}` : ""}
            {meeting.file_name ? ` · ${meeting.file_name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={meeting.status} />
          {!isProcessing && (
            <>
              <input ref={appendInputRef} type="file" accept=".mp3,.wav,.mp4,.m4a,.webm" className="hidden" onChange={handleAppend} />
              <button
                onClick={() => appendInputRef.current?.click()}
                disabled={appending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {appending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                Add Audio
              </button>
              {meeting.status === "completed" && (
                <>
                  <button
                    onClick={handleReanalyze}
                    disabled={reanalyzing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    title="Re-run AI analysis on existing transcript"
                  >
                    {reanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Reanalyze
                  </button>
                  <ExportMenu meetingId={meeting.id} />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {appendError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {appendError}
        </div>
      )}

      {isProcessing && <ProcessingSteps current={liveStep} />}

      {meeting.status === "failed" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">Processing failed</p>
            {meeting.error_message && (
              <p className="text-sm text-red-600 mt-1 font-mono">{meeting.error_message}</p>
            )}
          </div>
        </div>
      )}

      {meeting.status === "completed" && (
        <>
          <div className="flex border-b border-gray-200 mb-6 gap-0">
            {TABS.map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                onClick={() => setTab(tabId)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 -mb-px ${
                  tab === tabId
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {tabId === "topics" && meeting.topics.length > 0 && (
                  <span className="ml-1 bg-gray-100 text-gray-600 text-xs font-medium px-1.5 py-0.5 rounded-full">
                    {meeting.topics.length}
                  </span>
                )}
                {tabId === "actions" && meeting.action_items.length > 0 && (
                  <span className="ml-1 bg-gray-100 text-gray-600 text-xs font-medium px-1.5 py-0.5 rounded-full">
                    {meeting.action_items.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: CheckCircle2, value: meeting.resolved_count,    label: "Topics Resolved", color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200" },
                  { icon: Clock,        value: meeting.pending_count,      label: "Topics Pending",  color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
                  { icon: ListTodo,     value: meeting.action_items_count, label: "Action Items",    color: "text-gray-700",   bg: "bg-gray-50",   border: "border-gray-200" },
                ].map(({ icon: Icon, value, label, color, bg, border }) => (
                  <div key={label} className={`${bg} border ${border} rounded-xl p-5 flex flex-col items-center gap-2`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500 text-center">{label}</p>
                  </div>
                ))}
              </div>

              {meeting.intelligence?.summary && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="text-base font-bold text-gray-900">Meeting Summary</h2>
                    {(meeting.extra_audio_files?.length ?? 0) > 0 && (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                        Summary reflects original recording only — use Reanalyze to update
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{meeting.intelligence.summary}</p>
                </div>
              )}

              {(meeting.intelligence?.key_decisions?.length ?? 0) > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
                  <h2 className="text-base font-bold text-gray-900">Key Decisions</h2>
                  <ul className="space-y-2">
                    {meeting.intelligence!.key_decisions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-900 shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(() => {
                const blockers = pendingTopics.flatMap((t) => [t.blocker, t.stopped_at].filter((v): v is string => !!v));
                if (!blockers.length) return null;
                return (
                  <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
                    <h2 className="text-base font-bold text-gray-900">Blockers / Risks</h2>
                    <ul className="space-y-2">
                      {blockers.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>
          )}

          {tab === "topics" && (
            <div className="space-y-6">
              {meeting.topics.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No topics extracted.</p>
              ) : (
                <>
                  {resolvedTopics.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Resolved · {resolvedTopics.length}
                      </h3>
                      {resolvedTopics.map((t) => <TopicCard key={t.id} topic={t} recordingLabel={getRecordingLabel(t.recording_index ?? 0)} />)}
                    </div>
                  )}
                  {pendingTopics.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Unresolved · {pendingTopics.length}
                      </h3>
                      {pendingTopics.map((t) => <TopicCard key={t.id} topic={t} recordingLabel={getRecordingLabel(t.recording_index ?? 0)} />)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "actions" && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Action Items</h2>
                {meeting.action_items_count > 0 && (
                  <span className="text-sm text-gray-500">{completedActions}/{meeting.action_items_count} completed</span>
                )}
              </div>
              <ActionItemList items={displayItems} onToggle={handleToggle} getRecordingLabel={getRecordingLabel} />
            </div>
          )}

          {tab === "transcript" && (
            <div>
              {meeting.transcript ? (
                <TranscriptPlayer
                  transcript={meeting.transcript}
                  fileUrl={meeting.file_url ?? undefined}
                  extraAudioFiles={meeting.extra_audio_files ?? []}
                />
              ) : (
                <p className="text-sm text-gray-500 italic">No transcript available.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

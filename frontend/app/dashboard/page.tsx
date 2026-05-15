"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Upload, FileText, Calendar, Clock, CheckCircle } from "lucide-react";
import { MeetingCard } from "@/components/MeetingCard";
import { listMeetings, deleteMeeting } from "@/lib/api";
import type { Meeting } from "@/lib/types";

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

export default function DashboardPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMeetings({ search: search || undefined, status: status || undefined });
      setMeetings(data);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    const hasProcessing = meetings.some(
      (m) => m.status === "processing" || m.status === "pending"
    );
    if (!hasProcessing) return;
    const timer = setTimeout(fetch, 5000);
    return () => clearTimeout(timer);
  }, [meetings, fetch]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this meeting?")) return;
    await deleteMeeting(id);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  }

  const totalMeetings = meetings.length;
  const thisMonth = meetings.filter((m) => {
    const d = new Date(m.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const hoursProcessed = (
    meetings.reduce((s, m) => s + (m.duration_seconds || 0), 0) / 3600
  ).toFixed(1);
  const totalActions = meetings.reduce((s, m) => s + (m.action_items_count || 0), 0);

  const STATS = [
    { icon: FileText, label: "Total Meetings", value: totalMeetings },
    { icon: Calendar, label: "This Month", value: thisMonth },
    { icon: Clock, label: "Hours Processed", value: hoursProcessed },
    { icon: CheckCircle, label: "Action Items", value: totalActions },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2>Dashboard</h2>
          <p className="text-gray-500 mt-1">Overview of your meeting intelligence</p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Upload size={16} />
          Upload
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-6 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Icon size={18} className="text-gray-500" />
              <p className="text-sm text-gray-500">{label}</p>
            </div>
            <p className="text-3xl font-medium">{value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meetings..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                status === tab.value
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meeting list */}
      <div>
        <h3 className="mb-4">Recent Meetings</h3>
        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white border border-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No meetings found.</p>
            <p className="text-sm mt-1">Upload a recording to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {meetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

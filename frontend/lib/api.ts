import type { Meeting, MeetingDetail } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function uploadMeeting(
  file: File,
  title?: string
): Promise<{ meeting_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  return request("/api/upload", { method: "POST", body: form });
}

export async function listMeetings(params?: {
  search?: string;
  status?: string;
}): Promise<Meeting[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString() ? `?${qs}` : "";
  return request(`/api/meetings${query}`);
}

export async function getMeeting(id: string): Promise<MeetingDetail> {
  return request(`/api/meetings/${id}`);
}

export async function updateActionItem(
  meetingId: string,
  itemId: string,
  status: "pending" | "completed"
): Promise<void> {
  await request(`/api/meetings/${meetingId}/action-items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function deleteMeeting(id: string): Promise<void> {
  await request(`/api/meetings/${id}`, { method: "DELETE" });
}

export async function searchMeetings(q: string): Promise<{
  meetings: Array<{ id: string; title: string; status: string; created_at: string }>;
  topics: Array<{ meeting_id: string; title: string; status: string }>;
}> {
  return request(`/api/search?q=${encodeURIComponent(q)}`);
}

export async function reanalyzeMeeting(id: string): Promise<void> {
  await request(`/api/meetings/${id}/reanalyze`, { method: "POST" });
}

export async function appendAudio(
  meetingId: string,
  file: File
): Promise<{ meeting_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  return request(`/api/meetings/${meetingId}/append`, { method: "POST", body: form });
}

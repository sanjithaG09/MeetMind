export type MeetingStatus = "pending" | "processing" | "completed" | "failed";
export type ProcessingStep = "transcribing" | "analyzing" | null;
export type TopicStatus = "resolved" | "pending";
export type ActionStatus = "pending" | "completed";

export interface Segment {
  start: number;
  end: number;
  text: string;
  audio_index?: number; // 0 = original recording, 1 = first append, etc.
}

export interface TranscriptData {
  full_text: string;
  language?: string;
  segments: Segment[];
}

export interface Topic {
  id: string;
  title: string;
  summary?: string;
  status: TopicStatus;
  decision?: string;
  reason?: string;
  stopped_at?: string;
  blocker?: string;
  next_step?: string;
  position: number;
  recording_index?: number;
}

export interface ActionItem {
  id: string;
  assignee: string;
  task: string;
  priority?: "high" | "medium" | "low";
  deadline?: string;
  status: ActionStatus;
  topic_title?: string;
  recording_index?: number;
}

export interface MeetingIntelligence {
  summary?: string;
  key_decisions: string[];
  unresolved_count: number;
  total_topics: number;
}

export interface AudioFile {
  url: string;
  file_name: string;
  uploaded_at?: string;
}

export interface Meeting {
  id: string;
  title: string;
  status: MeetingStatus;
  processing_step?: ProcessingStep;
  created_at: string;
  duration_seconds?: number;
  file_url?: string;
  file_name?: string;
  extra_audio_files?: AudioFile[];
  total_topics: number;
  resolved_count: number;
  pending_count: number;
  action_items_count: number;
  error_message?: string;
}

export interface MeetingDetail extends Meeting {
  transcript?: TranscriptData;
  intelligence?: MeetingIntelligence;
  topics: Topic[];
  action_items: ActionItem[];
}

-- Run this in the Supabase SQL editor to set up the database.
-- Also create a Storage bucket named "meeting-files" and make it public.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core meetings table
CREATE TABLE meetings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  duration_seconds INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw transcript + segments
CREATE TABLE transcripts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  full_text TEXT NOT NULL,
  language TEXT,
  segments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topics extracted from the meeting
CREATE TABLE topics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL CHECK (status IN ('resolved', 'pending')),
  decision TEXT,
  reason TEXT,
  stopped_at TEXT,
  blocker TEXT,
  next_step TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Action items per meeting
CREATE TABLE action_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  assignee TEXT NOT NULL,
  task TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Migration (if table already exists): ALTER TABLE action_items ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));

-- High-level intelligence summary per meeting
CREATE TABLE meeting_intelligence (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE UNIQUE,
  summary TEXT,
  key_decisions JSONB DEFAULT '[]',
  unresolved_count INTEGER DEFAULT 0,
  total_topics INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX idx_topics_meeting_id ON topics(meeting_id);
CREATE INDEX idx_action_items_meeting_id ON action_items(meeting_id);
CREATE INDEX idx_transcripts_meeting_id ON transcripts(meeting_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Migration: real-time processing steps
-- Run this if the table already exists:
-- ALTER TABLE meetings ADD COLUMN IF NOT EXISTS processing_step TEXT
--   CHECK (processing_step IN ('transcribing', 'analyzing'));

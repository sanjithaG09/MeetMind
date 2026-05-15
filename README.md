<p align="center">
<pre align="center">
  __  __           _   __  __ _           _ 
 |  \/  | ___  ___| |_|  \/  (_)_ __   __| |
 | |\/| |/ _ \/ _ \ __| |\/| | | '_ \ / _` |
 | |  | |  __/  __/ |_| |  | | | | | | (_| |
 |_|  |_|\___|\___|\__|_|  |_|_|_| |_|\__,_|
</pre>
</p>

<h1 align="center">MeetMind</h1>

<p align="center">
  <strong>AI Meeting Intelligence — local, private, and fully self-hosted</strong><br />
  <em>Upload a recording. Get back a transcript, topics, decisions, action items, and blockers in real time.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Next.js%2015-black?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Transcription-faster--whisper-FF6B35?style=for-the-badge" />
  <img src="https://img.shields.io/badge/LLM-Ollama%20%2F%20llama3-7C3AED?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-features">Features</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-project-structure">Project Structure</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-getting-started">Getting Started</a>
</p>

---

## 📖 Overview

**MeetMind** is a self-hosted AI meeting intelligence tool. Drop in any audio or video recording and the pipeline automatically transcribes it with [faster-whisper](https://github.com/SYSTRAN/faster-whisper), analyzes the transcript with a local LLM via [Ollama](https://ollama.com), and delivers structured results — topics, decisions, blockers, and action items with assignees and priorities — in real time via WebSockets.

Everything runs on your own machine. No data leaves your infrastructure. No API costs for transcription or AI.

---

## ✨ Features

### 🎙️ Recording & Transcription

| Capability | Description |
|---|---|
| **Audio / Video Upload** | Drag-and-drop or click to upload MP3, WAV, MP4, M4A, WebM (up to 500 MB) |
| **Local Transcription** | faster-whisper runs fully offline — CPU or GPU, no OpenAI account needed |
| **Multi-Recording Support** | Append follow-up recordings to any existing meeting; transcripts and timestamps merge automatically |
| **Re-analyze** | Re-run AI analysis on an existing transcript without re-transcribing (saves time after prompt tuning) |
| **Interactive Transcript Player** | Click any segment timestamp to instantly seek the audio player |

### 🤖 AI Analysis

| Capability | Description |
|---|---|
| **Topic Extraction** | Identifies every discussion topic with a title and summary |
| **Resolution Tracking** | Marks topics as Resolved or Pending based on what was decided vs. left open |
| **Decision Capture** | Extracts what was decided and the reasoning behind it |
| **Blocker Detection** | Flags blockers, risks, and "stopped at" points for unresolved topics |
| **Next Steps** | Captures next steps for each pending topic |
| **Meeting Summary** | High-level prose summary of the full meeting |
| **Key Decisions** | Bulleted list of the most important decisions made |

### ✅ Action Items

| Capability | Description |
|---|---|
| **Structured Extraction** | Each action item has an assignee, task description, priority, and deadline |
| **Priority Levels** | High / Medium / Low with color-coded badges |
| **Status Tracking** | Check off completed items; status persists across re-fetches |
| **Recording Attribution** | Items tagged to the recording they came from when using multi-recording |

### 📊 Dashboard & Search

| Capability | Description |
|---|---|
| **Meeting Dashboard** | All meetings with stats: resolved count, pending count, action item count |
| **Status Filtering** | Filter by Processing / Completed / Failed |
| **Full-Text Search** | Search across meeting titles and extracted topics |
| **Live Progress** | WebSocket pushes Transcribing → Analyzing → Complete in real time |

### 📤 Export

| Format | Contents |
|---|---|
| **PDF** | Full meeting report — summary, topics, decisions, action items |
| **Markdown** | Structured summary ready for Notion, GitHub, or any wiki |
| **CSV** | Action items table with assignee, priority, deadline for spreadsheets |

---

## 🔄 How It Works

```
  Upload audio/video
        │
        ▼
  Store file in Supabase Storage
        │
        ▼  (FastAPI BackgroundTask)
  ┌─────────────────────────────────────────┐
  │  Step 1 — Transcribing                  │
  │    faster-whisper (local, CPU or GPU)   │
  │    → full_text + timestamped segments   │
  ├─────────────────────────────────────────┤
  │  Step 2 — Analyzing                     │
  │    Ollama llama3 reads the transcript   │
  │    → topics, decisions, action items    │
  │    → summary, key decisions, blockers   │
  └─────────────────────────────────────────┘
        │
        │  WebSocket broadcasts each step to the browser
        ▼
  Store in Supabase PostgreSQL:
    meetings · transcripts · topics
    action_items · meeting_intelligence
        │
        ▼
  Next.js frontend renders results
```

### End-to-End Flow

1. **User uploads** a recording via the drag-and-drop form
2. **File is stored** in Supabase Storage and a meeting record is created
3. **BackgroundTask starts** — the pipeline runs asynchronously
4. **Step 1 — Transcribing:** faster-whisper converts audio to text with word-level timestamps
5. **Step 2 — Analyzing:** Ollama (llama3) reads the full transcript and extracts structured data:
   - Topics with resolution status, decisions, and blockers
   - Action items with assignees, priorities, and deadlines
   - A meeting summary and key decisions list
6. **WebSocket** pushes each step update to the browser so the UI reflects progress live
7. **Results land in the database** and the meeting detail page renders automatically

---

## 🛠️ Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **Next.js 15** | App Router, server/client components, file-based routing |
| **React 18** | UI component model |
| **TypeScript** | End-to-end type safety |
| **Tailwind CSS 3** | Utility-first styling |
| **Lucide React** | Icon library |
| **Native WebSocket** | Real-time processing updates |
| **Native fetch** | HTTP client for all API calls |

### Backend

| Technology | Purpose |
|---|---|
| **FastAPI** | High-performance async API framework |
| **Python 3.11+** | Backend language |
| **Uvicorn** | ASGI server |
| **faster-whisper** | Local speech-to-text (CTranslate2 optimized) |
| **Ollama** | Local LLM inference (default: llama3) |
| **FastAPI BackgroundTasks** | Async processing pipeline |
| **FastAPI WebSockets** | Real-time step broadcasting |
| **fpdf2** | PDF generation for exports |
| **Pydantic v2** | Request/response validation |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Supabase** | PostgreSQL database + file storage |
| **Supabase Storage** | Audio/video file hosting with public URLs |

---

## 📁 Project Structure

```text
AI_MeetingResolution/
│
├── backend/                        # FastAPI application
│   ├── main.py                     # App entry point, CORS, router wiring
│   ├── config.py                   # Settings — Supabase, Whisper, Ollama
│   ├── database.py                 # Supabase client factory
│   ├── ws_manager.py               # WebSocket connection manager
│   ├── requirements.txt            # Python dependencies
│   │
│   ├── routers/
│   │   ├── upload.py               # POST /api/upload  ·  POST /api/meetings/:id/append
│   │   ├── meetings.py             # GET · DELETE /api/meetings  ·  PATCH action items
│   │   ├── export.py               # GET /api/meetings/:id/export/:format
│   │   └── ws.py                   # WS /ws/meetings/:id
│   │
│   ├── services/
│   │   ├── processor.py            # Full pipeline: upload → transcribe → analyze → store
│   │   ├── transcription.py        # faster-whisper wrapper
│   │   └── analysis.py             # Ollama prompt + JSON response parser
│   │
│   └── models/
│       └── schemas.py              # Pydantic request / response models
│
├── frontend/                       # Next.js application
│   ├── app/
│   │   ├── layout.tsx              # Root layout with Sidebar
│   │   ├── page.tsx                # Redirects / → /dashboard
│   │   ├── globals.css             # Base Tailwind styles
│   │   ├── dashboard/page.tsx      # Meeting list, stats, status filter
│   │   ├── upload/page.tsx         # Upload page
│   │   ├── search/page.tsx         # Full-text search across meetings & topics
│   │   └── meetings/[id]/page.tsx  # Detail view — Overview, Topics, Actions, Transcript tabs
│   │
│   ├── components/
│   │   ├── Sidebar.tsx             # Navigation sidebar with active state
│   │   ├── MeetingCard.tsx         # Dashboard meeting row with status chip
│   │   ├── MeetingUpload.tsx       # Drag-and-drop upload form
│   │   ├── TopicCard.tsx           # Topic card with resolution status
│   │   ├── ActionItemList.tsx      # Checkable action items with priority badges
│   │   ├── StatusBadge.tsx         # Pending / Processing / Completed / Failed chips
│   │   ├── TranscriptPlayer.tsx    # Audio player synced to transcript segments
│   │   └── ExportMenu.tsx          # PDF / Markdown / CSV export dropdown
│   │
│   ├── lib/
│   │   ├── api.ts                  # All fetch calls to the backend API
│   │   ├── types.ts                # TypeScript interfaces (Meeting, Topic, ActionItem…)
│   │   └── utils.ts                # cn(), formatDate(), formatDuration(), formatTime()
│   │
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── postcss.config.js
│
├── supabase/
│   └── schema.sql                  # Full DB schema — run once to set up tables
│
├── .gitignore
└── README.md
```

---

## 📡 API Reference

All endpoints are prefixed with `/api`. WebSocket endpoint is at `/ws`.

### Upload

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload a new meeting recording (multipart/form-data) |
| `POST` | `/api/meetings/:id/append` | Append an additional recording to an existing meeting |

### Meetings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/meetings` | List all meetings — supports `?search=` and `?status=` |
| `GET` | `/api/meetings/:id` | Get full meeting detail (transcript, topics, action items) |
| `DELETE` | `/api/meetings/:id` | Delete a meeting and all associated data |
| `POST` | `/api/meetings/:id/reanalyze` | Re-run AI analysis on the existing transcript |
| `PATCH` | `/api/meetings/:id/action-items/:itemId` | Toggle action item status (pending ↔ completed) |

### Export

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/meetings/:id/export/pdf` | Download full meeting report as PDF |
| `GET` | `/api/meetings/:id/export/markdown` | Download meeting summary as Markdown |
| `GET` | `/api/meetings/:id/export/csv` | Download action items as CSV |

### Search & Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/search?q=` | Full-text search across meetings and topics |
| `GET` | `/health` | Backend health check |

### WebSocket

| Protocol | Endpoint | Description |
|---|---|---|
| `WS` | `/ws/meetings/:id` | Real-time processing step updates |

**WebSocket message format:**
```json
{ "step": "transcribing" | "analyzing" | "completed" | "failed" }
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** 3.11+
- **Ollama** — [install from ollama.com](https://ollama.com)
- A **Supabase** project (free tier is sufficient)

---

### 1 — Clone the repository

```bash
git clone <your-repo-url>
cd AI_MeetingResolution
```

---

### 2 — Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → run the contents of `supabase/schema.sql`
3. Go to **Storage** → create a **public** bucket named `meeting-files`
4. Copy your **Project URL** and **Service Role Key** from Settings → API

---

### 3 — Backend setup

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
```

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Whisper — model size vs speed tradeoff (see table below)
WHISPER_MODEL=tiny
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8

# Ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3
```

Pull the LLM and start Ollama:

```bash
ollama pull llama3
ollama serve
```

Start the API server:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Verify: `http://localhost:8000/health` → `{"status": "ok"}`

---

### 4 — Frontend setup

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env
npm run dev
```

App is live at `http://localhost:3000`

---

### Whisper Model Reference

| Model | Size | Best for |
|---|---|---|
| `tiny` | 75 MB | Fast testing on CPU |
| `base` | 145 MB | Good balance for most use cases |
| `small` | 466 MB | Better accuracy, still reasonable speed |
| `medium` | 1.5 GB | High accuracy |
| `large-v3` | 3 GB | Best accuracy — use with GPU |

Set `WHISPER_MODEL` in `backend/.env` to switch models.

---

## 📝 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | — | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | — | Supabase service role key (not the anon key) |
| `WHISPER_MODEL` | | `tiny` | faster-whisper model size |
| `WHISPER_DEVICE` | | `cpu` | `cpu` or `cuda` |
| `WHISPER_COMPUTE_TYPE` | | `int8` | `int8` for CPU · `float16` for GPU |
| `OLLAMA_HOST` | | `http://localhost:11434` | Ollama server base URL |
| `OLLAMA_MODEL` | | `llama3` | Any model pulled via `ollama pull` |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | | `http://localhost:8000` | Backend base URL |

---

## 📄 License

MIT

---

<p align="center">
  <pre align="center">◈  MeetMind — turn every meeting into a clear record  ◈</pre>
</p>

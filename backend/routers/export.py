import csv
import io
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, PlainTextResponse
from fpdf import FPDF

from database import get_supabase

router = APIRouter()


# ─── helpers ───────────────────────────────────────────────────────────────────

def _load(meeting_id: str) -> dict:
    sb = get_supabase()

    m = sb.table("meetings").select("*").eq("id", meeting_id).single().execute()
    if not m.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if m.data["status"] != "completed":
        raise HTTPException(status_code=400, detail="Meeting has not finished processing")

    topics = sb.table("topics").select("*").eq("meeting_id", meeting_id).order("position").execute()
    actions = sb.table("action_items").select("*").eq("meeting_id", meeting_id).execute()
    intel = sb.table("meeting_intelligence").select("*").eq("meeting_id", meeting_id).execute()

    return {
        "meeting": m.data,
        "topics": topics.data or [],
        "actions": actions.data or [],
        "intel": intel.data[0] if intel.data else {},
    }


def _fmt_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%B %d, %Y")
    except Exception:
        return iso


def _fmt_duration(secs: int | None) -> str:
    if not secs:
        return ""
    h, m = divmod(secs, 3600)
    m //= 60
    return f"{h}h {m}m" if h else f"{m}m"


def _safe(text: str | None) -> str:
    """Strip characters fpdf core fonts can't encode."""
    if not text:
        return ""
    return text.encode("latin-1", errors="replace").decode("latin-1")


# ─── PDF ───────────────────────────────────────────────────────────────────────

class _PDF(FPDF):
    _title: str = ""

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 8, _safe(self._title), align="L")
        self.ln(2)
        self.set_draw_color(220, 220, 220)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)
        self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")
        self.set_text_color(0, 0, 0)


def _section(pdf: _PDF, title: str):
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(67, 56, 202)   # indigo-700
    pdf.cell(0, 8, title.upper(), ln=True)
    pdf.set_draw_color(199, 210, 254)  # indigo-200
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(3)
    pdf.set_text_color(0, 0, 0)


def _bullet(pdf: _PDF, text: str, indent: float = 4):
    pdf.set_font("Helvetica", "", 10)
    pdf.set_x(pdf.l_margin + indent)
    pdf.cell(4, 6, "-")
    pdf.multi_cell(0, 6, _safe(text))


def _label_value(pdf: _PDF, label: str, value: str | None, indent: float = 6):
    if not value:
        return
    pdf.set_x(pdf.l_margin + indent)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(28, 5, _safe(label) + ":", ln=False)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(0, 5, _safe(value))
    pdf.set_text_color(0, 0, 0)


def _build_pdf(data: dict) -> bytes:
    meeting = data["meeting"]
    topics = data["topics"]
    actions = data["actions"]
    intel = data["intel"]

    pdf = _PDF(orientation="P", unit="mm", format="A4")
    pdf._title = meeting["title"]
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    # ── Cover block ──────────────────────────────────────────────────────────
    pdf.set_fill_color(238, 242, 255)   # indigo-50
    pdf.rect(pdf.l_margin, pdf.get_y(), pdf.w - pdf.l_margin - pdf.r_margin, 28, "F")
    pdf.ln(5)

    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(31, 41, 55)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 9, _safe(meeting["title"]))

    meta_parts = [_fmt_date(meeting["created_at"])]
    if meeting.get("duration_seconds"):
        meta_parts.append(_fmt_duration(meeting["duration_seconds"]))
    if meeting.get("file_name"):
        meta_parts.append(meeting["file_name"])
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(107, 114, 128)
    pdf.set_x(pdf.l_margin)
    pdf.cell(0, 6, "  ".join(meta_parts), ln=True)
    pdf.ln(6)
    pdf.set_text_color(0, 0, 0)

    # ── Stats row ─────────────────────────────────────────────────────────────
    resolved = sum(1 for t in topics if t["status"] == "resolved")
    pending  = sum(1 for t in topics if t["status"] == "pending")
    col_w = (pdf.w - pdf.l_margin - pdf.r_margin) / 3

    pdf.set_font("Helvetica", "B", 20)
    for val, label, color in [
        (str(resolved), "Resolved",     (22, 163, 74)),
        (str(pending),  "Pending",      (217, 119, 6)),
        (str(len(actions)), "Actions",  (99, 102, 241)),
    ]:
        x = pdf.get_x()
        pdf.set_text_color(*color)
        pdf.cell(col_w, 8, val, align="C")
    pdf.ln(8)

    pdf.set_font("Helvetica", "", 8)
    for val, label, color in [
        ("", "Resolved",  (22, 163, 74)),
        ("", "Pending",   (217, 119, 6)),
        ("", "Actions",   (99, 102, 241)),
    ]:
        pdf.set_text_color(*color)
        pdf.cell(col_w, 5, label, align="C")
    pdf.ln(8)
    pdf.set_text_color(0, 0, 0)

    # ── Summary ───────────────────────────────────────────────────────────────
    if intel.get("summary"):
        _section(pdf, "Meeting Summary")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(55, 65, 81)
        pdf.multi_cell(0, 6, _safe(intel["summary"]))
        pdf.set_text_color(0, 0, 0)

    # ── Key decisions ─────────────────────────────────────────────────────────
    decisions = intel.get("key_decisions") or []
    if decisions:
        _section(pdf, "Key Decisions")
        for d in decisions:
            _bullet(pdf, d)

    # ── Topics ────────────────────────────────────────────────────────────────
    if topics:
        _section(pdf, "Topics")
        for topic in topics:
            pdf.ln(2)
            status_color = (22, 163, 74) if topic["status"] == "resolved" else (217, 119, 6)
            tag = "RESOLVED" if topic["status"] == "resolved" else "PENDING"

            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(31, 41, 55)
            title_w = pdf.w - pdf.l_margin - pdf.r_margin - 22
            pdf.cell(title_w, 6, _safe(topic["title"]))
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(*status_color)
            pdf.cell(22, 6, tag, align="R", ln=True)
            pdf.set_text_color(0, 0, 0)

            if topic.get("summary"):
                pdf.set_x(pdf.l_margin + 4)
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(75, 85, 99)
                pdf.multi_cell(0, 5, _safe(topic["summary"]))
                pdf.set_text_color(0, 0, 0)

            if topic["status"] == "resolved":
                _label_value(pdf, "Decision", topic.get("decision"))
                _label_value(pdf, "Reason",   topic.get("reason"))
            else:
                _label_value(pdf, "Stopped at", topic.get("stopped_at"))
                _label_value(pdf, "Blocker",    topic.get("blocker"))
                _label_value(pdf, "Next step",  topic.get("next_step"))

    # ── Action items ──────────────────────────────────────────────────────────
    if actions:
        _section(pdf, "Action Items")
        pdf.ln(1)

        # Table header
        col_task     = 85
        col_assignee = 40
        col_deadline = 35
        col_status   = 22

        pdf.set_fill_color(238, 242, 255)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(67, 56, 202)
        pdf.cell(col_task,     6, "Task",     border=0, fill=True)
        pdf.cell(col_assignee, 6, "Assignee", border=0, fill=True)
        pdf.cell(col_deadline, 6, "Deadline", border=0, fill=True)
        pdf.cell(col_status,   6, "Status",   border=0, fill=True, ln=True)

        pdf.set_draw_color(199, 210, 254)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.ln(1)

        for i, item in enumerate(actions):
            pdf.set_fill_color(249, 250, 251) if i % 2 == 0 else pdf.set_fill_color(255, 255, 255)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(31, 41, 55)

            # Save Y for multi-line task alignment
            y_before = pdf.get_y()
            pdf.multi_cell(col_task, 5, _safe(item.get("task", "")), fill=True)
            y_after = pdf.get_y()
            row_h = y_after - y_before

            pdf.set_xy(pdf.l_margin + col_task, y_before)
            pdf.set_text_color(75, 85, 99)
            pdf.cell(col_assignee, row_h, _safe(item.get("assignee", "")), fill=True)
            pdf.cell(col_deadline, row_h, _safe(item.get("deadline") or "—"), fill=True)

            status = item.get("status", "pending")
            pdf.set_text_color(22, 163, 74) if status == "completed" else pdf.set_text_color(217, 119, 6)
            pdf.cell(col_status, row_h, status.capitalize(), fill=True, ln=True)
            pdf.set_text_color(0, 0, 0)

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


# ─── Markdown ──────────────────────────────────────────────────────────────────

def _build_markdown(data: dict) -> str:
    meeting = data["meeting"]
    topics  = data["topics"]
    actions = data["actions"]
    intel   = data["intel"]

    lines: list[str] = []
    def w(*parts): lines.extend(parts)
    def blank(): lines.append("")

    w(f"# {meeting['title']}")
    meta = [_fmt_date(meeting["created_at"])]
    if meeting.get("duration_seconds"):
        meta.append(_fmt_duration(meeting["duration_seconds"]))
    w(f"_{' · '.join(meta)}_")
    blank()

    resolved = sum(1 for t in topics if t["status"] == "resolved")
    pending  = sum(1 for t in topics if t["status"] == "pending")
    w(f"**{resolved}** resolved · **{pending}** pending · **{len(actions)}** action items")
    blank()

    if intel.get("summary"):
        w("## Summary", blank.__doc__ or "", intel["summary"])
        blank()

    decisions = intel.get("key_decisions") or []
    if decisions:
        w("## Key Decisions")
        for d in decisions:
            w(f"- {d}")
        blank()

    if topics:
        w("## Topics")
        blank()
        resolved_topics = [t for t in topics if t["status"] == "resolved"]
        pending_topics  = [t for t in topics if t["status"] == "pending"]

        if resolved_topics:
            w("### Resolved")
            blank()
            for t in resolved_topics:
                w(f"#### ✅ {t['title']}")
                if t.get("summary"):
                    w(t["summary"])
                if t.get("decision"):
                    w(f"**Decision:** {t['decision']}")
                if t.get("reason"):
                    w(f"**Reason:** {t['reason']}")
                blank()

        if pending_topics:
            w("### Unresolved")
            blank()
            for t in pending_topics:
                w(f"#### ⏳ {t['title']}")
                if t.get("summary"):
                    w(t["summary"])
                if t.get("stopped_at"):
                    w(f"**Stopped at:** {t['stopped_at']}")
                if t.get("blocker"):
                    w(f"**Blocker:** {t['blocker']}")
                if t.get("next_step"):
                    w(f"**Next step:** {t['next_step']}")
                blank()

    if actions:
        w("## Action Items")
        blank()
        w("| Task | Assignee | Deadline | Status |")
        w("|------|----------|----------|--------|")
        for a in actions:
            task     = (a.get("task") or "").replace("|", "\\|")
            assignee = a.get("assignee") or "—"
            deadline = a.get("deadline") or "—"
            status   = a.get("status", "pending").capitalize()
            w(f"| {task} | {assignee} | {deadline} | {status} |")
        blank()

    w(f"---")
    w(f"_Exported from MeetingMind on {datetime.now().strftime('%B %d, %Y')}_")

    return "\n".join(lines)


# ─── CSV ───────────────────────────────────────────────────────────────────────

def _build_csv(data: dict) -> str:
    actions = data["actions"]
    meeting = data["meeting"]

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Meeting", "Task", "Assignee", "Deadline", "Status", "Topic"])
    title = meeting["title"]
    for a in actions:
        writer.writerow([
            title,
            a.get("task", ""),
            a.get("assignee", ""),
            a.get("deadline") or "",
            a.get("status", "pending"),
            a.get("topic_title") or "",
        ])
    return buf.getvalue()


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.get("/meetings/{meeting_id}/export/pdf")
async def export_pdf(meeting_id: str):
    data = _load(meeting_id)
    pdf_bytes = _build_pdf(data)
    slug = data["meeting"]["title"][:40].replace(" ", "_")
    filename = f"{slug}_summary.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/meetings/{meeting_id}/export/markdown")
async def export_markdown(meeting_id: str):
    data = _load(meeting_id)
    md = _build_markdown(data)
    slug = data["meeting"]["title"][:40].replace(" ", "_")
    filename = f"{slug}_summary.md"
    return PlainTextResponse(
        md,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/meetings/{meeting_id}/export/csv")
async def export_csv(meeting_id: str):
    data = _load(meeting_id)
    content = _build_csv(data)
    slug = data["meeting"]["title"][:40].replace(" ", "_")
    filename = f"{slug}_actions.csv"
    return StreamingResponse(
        io.StringIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

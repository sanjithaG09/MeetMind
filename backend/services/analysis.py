from typing import Literal
from pydantic import BaseModel, model_validator
import ollama
from config import settings


# ── Output schema ─────────────────────────────────────────────────────────────

class TopicOutput(BaseModel):
    title: str
    summary: str = ""
    status: Literal["resolved", "pending"]
    decision: str | None = None
    reason: str | None = None
    stopped_at: str | None = None
    blocker: str | None = None
    next_step: str | None = None
    position: int = 0


class ActionItemOutput(BaseModel):
    assignee: str
    task: str
    priority: Literal["high", "medium", "low"] = "medium"
    deadline: str | None = None
    topic_title: str | None = None


class MeetingAnalysis(BaseModel):
    summary: str
    topics: list[TopicOutput]
    action_items: list[ActionItemOutput]
    key_decisions: list[str]
    unresolved_count: int
    total_topics: int

    @model_validator(mode="after")
    def sync_counts(self) -> "MeetingAnalysis":
        self.total_topics = len(self.topics)
        self.unresolved_count = sum(1 for t in self.topics if t.status == "pending")
        return self


_SCHEMA = MeetingAnalysis.model_json_schema()


# ── Step 1 prompt: free-form extraction ───────────────────────────────────────
# llama3 produces much richer content when unconstrained.  We ask for a
# structured-but-plain-text report, then convert it to JSON in step 2.

_STEP1_SYSTEM = """You are an expert meeting analyst. Read the transcript carefully and write a complete meeting report.

Your report MUST cover every topic discussed — do not skip anything.

Use this exact format:

MEETING SUMMARY
[3-5 sentences: what the meeting was about, key issues raised, decisions made, overall outcome]

RESOLVED TOPICS
For each topic the team reached a clear decision on:
TOPIC: [short title]
SUMMARY: [1-2 sentences on what was discussed]
DECISION: [exactly what was decided or concluded — be specific]
REASON: [why that decision was made]

PENDING TOPICS
For each topic that remains open, was deferred, or had no conclusion:
TOPIC: [short title]
SUMMARY: [1-2 sentences on what was discussed]
STOPPED AT: [where/why the discussion stalled or was deferred]
BLOCKER: [what is preventing a decision or completion]
NEXT STEP: [what needs to happen for this to move forward]

ACTION ITEMS
For each concrete task assigned to a named person:
- ASSIGNEE: [name] | TASK: [specific task] | PRIORITY: [high/medium/low] | DEADLINE: [as stated in transcript]

KEY DECISIONS
- [one-line statement of each major decision]

Rules:
- Extract EVERY topic. If the transcript covers 8 topics, list all 8.
- DECISION and REASON are REQUIRED for every resolved topic. Never leave them blank.
- BLOCKER and STOPPED AT are REQUIRED for every pending topic. Never leave them blank.
- Use only information stated in the transcript. Do not invent details."""


# ── Step 2 prompt: convert report → structured JSON ───────────────────────────

_STEP2_SYSTEM = """You are a JSON converter. Convert the meeting report below into the required JSON structure.

Rules:
- Every resolved topic MUST have non-empty "decision" and "reason" fields.
- Every pending topic MUST have non-empty "blocker" and "stopped_at" fields.
- Every action item MUST have non-empty "assignee" and "task" fields.
- "priority" must be exactly "high", "medium", or "low".
- "topic_title" in action items must exactly match a title from the topics list.
- "summary" must be at least 3 sentences.
- Include ALL topics from the report — do not drop any."""


# ── Validation ────────────────────────────────────────────────────────────────

def _validate(result: MeetingAnalysis) -> list[str]:
    errors: list[str] = []

    if len(result.summary.strip()) < 40:
        errors.append(f"summary is too short ({len(result.summary)} chars); write at least 3 full sentences")

    if not result.topics:
        errors.append("topics list is empty; extract every topic from the report")

    for t in result.topics:
        if not t.summary or len(t.summary.strip()) < 10:
            errors.append(f"topic '{t.title}': summary is missing or too short")
        if t.status == "resolved":
            if not t.decision or len(t.decision.strip()) < 5:
                errors.append(f"topic '{t.title}' is resolved but decision is empty — fill it in")
            if not t.reason or len(t.reason.strip()) < 5:
                errors.append(f"topic '{t.title}' is resolved but reason is empty — fill it in")
        else:
            if not t.blocker and not t.stopped_at:
                errors.append(f"topic '{t.title}' is pending but both blocker and stopped_at are empty — fill at least one")

    for a in result.action_items:
        if not a.assignee or not a.task:
            errors.append("action item is missing assignee or task")

    return errors


def _ctx_for(text: str, headroom: float = 1.5) -> int:
    """Estimate the num_ctx needed for a text, clamped to [4096, 32768]."""
    tokens = int(len(text) / 4 * headroom)
    return max(4096, min(tokens, 32768))


# ── Public API ────────────────────────────────────────────────────────────────

async def analyze_transcript(transcript: str) -> dict:
    client = ollama.AsyncClient(host=settings.ollama_host)

    # ── Step 1: free-form analysis ────────────────────────────────────────────
    step1_ctx = _ctx_for(transcript)
    step1_response = await client.chat(
        model=settings.ollama_model,
        messages=[
            {"role": "system", "content": _STEP1_SYSTEM},
            {"role": "user", "content": f"Write a complete meeting report for this transcript:\n\n{transcript}"},
        ],
        options={"num_ctx": step1_ctx, "temperature": 0},
    )
    free_form = step1_response.message.content.strip()

    # ── Step 2: convert to JSON, retry with validation feedback ───────────────
    # Step 2 input is the short report (not the full transcript), so ctx is much smaller.
    step2_ctx = _ctx_for(free_form)
    step2_messages = [
        {"role": "system", "content": _STEP2_SYSTEM},
        {"role": "user", "content": f"Convert this meeting report to JSON:\n\n{free_form}"},
    ]

    last_error: Exception | None = None
    for attempt in range(4):
        response = await client.chat(
            model=settings.ollama_model,
            messages=step2_messages,
            format=_SCHEMA,
            options={"num_ctx": step2_ctx, "temperature": 0},
        )

        try:
            result = MeetingAnalysis.model_validate_json(response.message.content)
            errors = _validate(result)
            if errors:
                raise ValueError("Quality issues:\n" + "\n".join(f"  - {e}" for e in errors))
            return result.model_dump()
        except Exception as exc:
            last_error = exc
            # Feed the error back so the next attempt can self-correct
            step2_messages.append({"role": "assistant", "content": response.message.content})
            step2_messages.append({
                "role": "user",
                "content": (
                    f"Your output had problems:\n{exc}\n\n"
                    "Fix every issue and return the corrected JSON. "
                    "Go back to the meeting report above and fill in all missing fields."
                ),
            })

    raise ValueError(f"Analysis failed after 4 attempts: {last_error}")

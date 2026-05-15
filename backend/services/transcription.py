import asyncio
import os
import tempfile

from faster_whisper import WhisperModel

# Loaded once on first use, reused for all subsequent requests.
_model: WhisperModel | None = None


def _load_model(size: str, device: str, compute_type: str) -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(size, device=device, compute_type=compute_type)
    return _model


def _transcribe_sync(
    file_bytes: bytes,
    filename: str,
    model_size: str,
    device: str,
    compute_type: str,
) -> dict:
    ext = os.path.splitext(filename)[1].lower() or ".mp3"

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        model = _load_model(model_size, device, compute_type)

        # segments is a lazy generator — iterating it runs the transcription.
        # vad_filter skips silent regions, giving a significant speedup.
        raw_segments, info = model.transcribe(
            tmp_path,
            beam_size=1,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )

        segments = [
            {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
            for seg in raw_segments
        ]

        full_text = " ".join(s["text"] for s in segments if s["text"])
        duration = segments[-1]["end"] if segments else None

        return {
            "text": full_text,
            "language": info.language,
            "duration": duration,
            "segments": segments,
        }
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def transcribe_audio(file_bytes: bytes, filename: str) -> dict:
    from config import settings

    return await asyncio.to_thread(
        _transcribe_sync,
        file_bytes,
        filename,
        settings.whisper_model,
        settings.whisper_device,
        settings.whisper_compute_type,
    )

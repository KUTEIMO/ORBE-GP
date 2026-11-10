#!/usr/bin/env python3
"""
Síntesis en memoria para Orbe360 Control Web usando Edge TTS (voz Salomé es-CO).
Lee JSON por stdin { text, voice?, rate? } y devuelve JSON por stdout:
{ audioBase64, mimeType, vtt, cues, durationSec, voice }
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import re
import sys

import edge_tts

DEFAULT_VOICE = "es-CO-SalomeNeural"
ALLOWED_VOICES = {
    "es-CO-SalomeNeural",
    "es-CO-GonzaloNeural",
    "es-MX-DaliaNeural",
    "es-ES-ElviraNeural",
}
TICKS_PER_SECOND = 10_000_000.0


def fmt_vtt_ts(seconds: float) -> str:
    ms_total = max(0, int(round(seconds * 1000)))
    h = ms_total // 3_600_000
    m = (ms_total % 3_600_000) // 60_000
    s = (ms_total % 60_000) // 1000
    ms = ms_total % 1000
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def split_cue(start: float, end: float, text: str, max_words: int = 12) -> list[dict]:
    words = text.split()
    if not words:
        return []
    if len(words) <= max_words:
        return [{"start": round(start, 3), "end": round(max(end, start + 0.35), 3), "text": text.strip()}]

    total_span = max(0.6, end - start)
    total_words = len(words)
    parts: list[dict] = []
    cursor = start
    for idx in range(0, total_words, max_words):
        chunk_words = words[idx : idx + max_words]
        ratio = len(chunk_words) / total_words
        seg_end = min(end, cursor + total_span * ratio) if idx + max_words < total_words else max(end, cursor + 0.35)
        parts.append(
            {
                "start": round(cursor, 3),
                "end": round(max(seg_end, cursor + 0.35), 3),
                "text": " ".join(chunk_words),
            }
        )
        cursor = seg_end
    return parts


def build_vtt(cues: list[dict]) -> str:
    lines = ["WEBVTT", ""]
    for i, c in enumerate(cues, start=1):
        lines.append(str(i))
        lines.append(f"{fmt_vtt_ts(c['start'])} --> {fmt_vtt_ts(c['end'])}")
        lines.append(c["text"])
        lines.append("")
    return "\n".join(lines)


async def run_tts(text: str, voice: str, rate: str) -> dict:
    comm = edge_tts.Communicate(text, voice=voice, rate=rate)
    buf = io.BytesIO()
    raw_cues: list[dict] = []

    async for chunk in comm.stream():
        ctype = chunk.get("type")
        if ctype == "audio":
            data = chunk.get("data")
            if data:
                buf.write(data)
        elif ctype in ("SentenceBoundary", "WordBoundary"):
            offset = float(chunk.get("offset", 0))
            duration = float(chunk.get("duration", 0))
            msg_text = str(chunk.get("text", "")).strip()
            if msg_text:
                start_s = offset / TICKS_PER_SECOND
                end_s = (offset + max(duration, 3_000_000.0)) / TICKS_PER_SECOND
                raw_cues.extend(split_cue(start_s, end_s, msg_text))

    audio_bytes = buf.getvalue()
    if not audio_bytes:
        raise RuntimeError("Edge TTS no devolvió audio MP3.")

    if not raw_cues:
        # Respaldo proporcional si el stream no incluyó límites de oración
        words = text.split()
        est_duration = max(1.8, len(words) / 2.4)
        raw_cues = split_cue(0.0, est_duration, text)

    duration_sec = max((c["end"] for c in raw_cues), default=0.0)
    return {
        "ok": True,
        "voice": voice,
        "rate": rate,
        "mimeType": "audio/mpeg",
        "audioBase64": base64.b64encode(audio_bytes).decode("ascii"),
        "cues": raw_cues,
        "vtt": build_vtt(raw_cues),
        "durationSec": round(duration_sec, 3),
    }


def main() -> int:
    try:
        raw = sys.stdin.buffer.read().decode("utf-8")
        payload = json.loads(raw or "{}")
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"JSON inválido: {exc}"}))
        return 1

    text = str(payload.get("text") or "").strip()
    if not text:
        print(json.dumps({"ok": False, "error": "Texto vacío para sintetizar."}))
        return 1
    if len(text) > 5000:
        print(json.dumps({"ok": False, "error": "El guion supera el límite de 5000 caracteres."}))
        return 1

    voice = str(payload.get("voice") or DEFAULT_VOICE).strip()
    if voice not in ALLOWED_VOICES:
        voice = DEFAULT_VOICE

    rate = str(payload.get("rate") or "-5%").strip()
    if not re.fullmatch(r"[+-]?\d{1,2}%", rate):
        rate = "-5%"

    try:
        result = asyncio.run(run_tts(text, voice, rate))
        sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
        return 0
    except Exception as exc:
        sys.stdout.buffer.write(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False).encode("utf-8"))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())


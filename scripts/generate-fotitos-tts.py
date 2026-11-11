#!/usr/bin/env python3
"""
Copia las 29 panoramas de Fotitos (Drive) a media/unisimoncucuta/<tourSlug>/panoramas/
y genera todos los audios Edge TTS (es-CO-SalomeNeural), .vtt, .txt y timing .json
bajo media/unisimoncucuta/<tourSlug>/assets/.

Uso:
  node scripts/export-fotitos-jobs.mjs | python scripts/generate-fotitos-tts.py
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
from pathlib import Path

import edge_tts

VOICE = "es-CO-SalomeNeural"
RATE = "-5%"
TICKS_PER_SECOND = 10_000_000.0
ROOT = Path(__file__).resolve().parents[1]


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
        return [
            {
                "start": round(start, 3),
                "end": round(max(end, start + 0.35), 3),
                "text": text.strip(),
            }
        ]
    total_span = max(0.6, end - start)
    total_words = len(words)
    parts: list[dict] = []
    cursor = start
    for idx in range(0, total_words, max_words):
        chunk_words = words[idx : idx + max_words]
        ratio = len(chunk_words) / total_words
        seg_end = (
            min(end, cursor + total_span * ratio)
            if idx + max_words < total_words
            else max(end, cursor + 0.35)
        )
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


async def synth_job(sem: asyncio.Semaphore, job: dict) -> dict:
    mp3_path = ROOT / job["mp3Rel"]
    vtt_path = ROOT / job["vttRel"]
    txt_path = ROOT / job["txtRel"]
    timing_path = ROOT / job["timingRel"]
    script_path = ROOT / job["scriptRel"] if job.get("scriptRel") else None

    for p in [mp3_path, vtt_path, txt_path, timing_path] + ([script_path] if script_path else []):
        p.parent.mkdir(parents=True, exist_ok=True)

    if script_path and not script_path.exists():
        title = job.get("title") or job["slug"]
        script_path.write_text(
            f"# {title}\n\n- Voz: `{VOICE}`\n\n## Guion de audiodescripción\n\n{job['text'].strip()}\n",
            encoding="utf-8",
        )

    if (
        mp3_path.exists()
        and mp3_path.stat().st_size > 1000
        and vtt_path.exists()
        and txt_path.exists()
        and (script_path is None or script_path.exists())
    ):
        return {"id": job["slug"], "cached": True}

    async with sem:
        comm = edge_tts.Communicate(job["text"], voice=VOICE, rate=RATE)
        audio_chunks = bytearray()
        cues: list[dict] = []
        async for chunk in comm.stream():
            ctype = chunk.get("type")
            if ctype == "audio":
                data = chunk.get("data")
                if data:
                    audio_chunks.extend(data)
            elif ctype in ("SentenceBoundary", "WordBoundary"):
                offset = float(chunk.get("offset", 0))
                duration = float(chunk.get("duration", 0))
                msg_text = str(chunk.get("text", "")).strip()
                if msg_text:
                    start_s = offset / TICKS_PER_SECOND
                    end_s = (offset + max(duration, 3_000_000.0)) / TICKS_PER_SECOND
                    cues.extend(split_cue(start_s, end_s, msg_text))

        if not audio_chunks:
            raise RuntimeError(f"Sin audio TTS para {job['slug']}")

        if not cues:
            words = job["text"].split()
            dur = max(3.0, len(words) * 0.42)
            cues = split_cue(0.0, dur, job["text"])

        mp3_path.write_bytes(bytes(audio_chunks))
        vtt_path.write_text(build_vtt(cues), encoding="utf-8")
        txt_path.write_text(job["text"].strip() + "\n", encoding="utf-8")
        timing_path.write_text(
            json.dumps({"voice": VOICE, "rate": RATE, "cues": cues}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if script_path:
            title = job.get("title") or job["slug"]
            script_path.write_text(
                f"# {title}\n\n- Voz: `{VOICE}`\n\n## Guion de audiodescripción\n\n{job['text'].strip()}\n",
                encoding="utf-8",
            )
        return {"id": job["slug"], "bytes": len(audio_chunks), "cues": len(cues), "cached": False}


async def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] != "-":
        raw = Path(sys.argv[1]).read_text(encoding="utf-8-sig")
    else:
        raw = sys.stdin.read().lstrip("\ufeff")
    payload = json.loads(raw)
    src_raw = (payload.get("srcDir") or "").strip()
    src_dir = Path(src_raw) if src_raw else None
    copies = payload["copies"]
    jobs = payload["jobs"]

    copied = 0
    for c in copies:
        dst = ROOT / c["dstRel"]
        dst.parent.mkdir(parents=True, exist_ok=True)
        src = (src_dir / c["fileKey"]) if src_dir else None
        if src and src.exists():
            if not dst.exists() or dst.stat().st_size != src.stat().st_size:
                shutil.copy2(src, dst)
                copied += 1
        elif not dst.exists():
            raise FileNotFoundError(
                f"Falta imagen fuente para {c['dstRel']}. Define ORBE_FOTITOS_SRC si necesitas reimportarla."
            )

    sem = asyncio.Semaphore(4)
    results = await asyncio.wait_for(
        asyncio.gather(*(synth_job(sem, j) for j in jobs)),
        timeout=240,
    )
    print(json.dumps({"copied": copied, "totalCopies": len(copies), "ttsGenerated": len(results)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    asyncio.run(main())


#!/usr/bin/env python3
"""
Generate accessibility TTS narrations for Orbe360 (Unisimón campus tour).

Produces, per sceneKey / hotspotKey (under media/unisimoncucuta/experienciavirtual/):
  assets/audio/scenes|{hotspots}/{key}.mp3
  assets/transcripts/scenes|{hotspots}/{key}.txt
  assets/captions/scenes|{hotspots}/{key}.vtt
  assets/accessibility/scripts/scenes|{hotspots}/{key}.md
  assets/accessibility/timing/scenes|{hotspots}/{key}.json  (from VTT cues)

Public URLs use /media/unisimoncucuta/experienciavirtual/assets/…

Requires: pip install edge-tts (Microsoft Edge neural voices; free, online).
Default voice: es-CO-SalomeNeural (Spanish Colombia).

Usage:
  python scripts/generate-a11y-tts.py
  python scripts/generate-a11y-tts.py --dry-run
  python scripts/generate-a11y-tts.py --only entrada-principal,biblioteca-lobby
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print(
        "Missing edge-tts. Install with:\n  python -m pip install edge-tts",
        file=sys.stderr,
    )
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
TENANT = ROOT / "media" / "unisimoncucuta" / "experienciavirtual"
ASSETS = TENANT / "assets"
MEDIA_URL_PREFIX = "/media/unisimoncucuta/experienciavirtual"
VOICE = "es-CO-SalomeNeural"
RATE = "-5%"  # slightly slower for accessibility comprehension
MANIFEST_PATH = ROOT / "scripts" / "a11y-tts-manifest.json"

# Representative campus scenes outside biblioteca-scenes.json (default path + zones).
CAMPUS_EXTRA = [
    {
        "file": "R0010060_202503281449_YP00145909.JPG",
        "id": "entrada-principal",
        "zone": "entrada",
        "title": "Entrada Principal - Acceso Sede 2",
        "shortTitle": "Entrada Principal",
        "longDescription": (
            "Te encuentras en la entrada principal de la Sede 2. "
            "A la izquierda está el punto de información y al frente se observa "
            "el acceso accesible con rampa y señalización."
        ),
        "pois": [
            "Punto de información a la izquierda",
            "Rampa de acceso accesible al frente",
            "Zona de espera y señalización del campus",
        ],
        "nav_hint": (
            "Desde el menú de escenas o la lista de destinos puedes ir a la biblioteca "
            "o avanzar al hall de ingreso."
        ),
    },
    {
        "file": "R0010061_202503281452_YP00145909.JPG",
        "id": "hall-ingreso",
        "zone": "entrada",
        "title": "Hall de Ingreso - Recepción Central",
        "shortTitle": "Hall de ingreso",
        "longDescription": (
            "Estás en el hall de ingreso y recepción central de la Sede 2. "
            "Es el punto de orientación hacia pasillos del Bloque B, aulas y servicios."
        ),
        "pois": [
            "Recepción central",
            "Conexión hacia pasillos del Bloque B",
        ],
        "nav_hint": (
            "Usa la lista de destinos para continuar hacia la cafetería, "
            "pasillos o salida."
        ),
    },
    {
        "file": "R0010068_202503281507_YP00145909.JPG",
        "id": "entrada-cafeteria",
        "zone": "cafeteria",
        "title": "Entrada Cafetería - Muro de Medios Unisimón",
        "shortTitle": "Entrada cafetería",
        "longDescription": (
            "Estás en la entrada de la cafetería, junto al muro de medios Unisimón. "
            "Desde aquí se accede al área de mesas y a la caseta de alimentos."
        ),
        "pois": [
            "Muro de medios Unisimón",
            "Acceso al pasillo de mesas de la cafetería",
        ],
        "nav_hint": (
            "Continúa hacia el pasillo de mesas o regresa a los pasillos del Bloque B."
        ),
    },
    {
        "file": "R0010072_202503281638_YP00145909.JPG",
        "id": "cafeteria-mesas",
        "zone": "cafeteria",
        "title": "Pasillo Cafetería - Mesas de comidas",
        "shortTitle": "Mesas cafetería",
        "longDescription": (
            "Estás en el pasillo de la cafetería con mesas para comidas. "
            "Es un espacio común de encuentro entre clases."
        ),
        "pois": [
            "Mesas de comidas",
            "Conexión hacia caseta de alimentos y baños",
        ],
        "nav_hint": (
            "Desde aquí puedes ir a la caseta de comidas, al control de ingreso "
            "de la biblioteca o al edificio cultural."
        ),
    },
    {
        "file": "R0010077_202503281643_YP00145909.JPG",
        "id": "cafeteria-caseta",
        "zone": "cafeteria",
        "title": "Cafetería - Caseta de comidas",
        "shortTitle": "Caseta cafetería",
        "longDescription": (
            "Estás frente a la caseta de cafetería de comidas frías y calientes. "
            "Aquí se atienden pedidos de alimentos y bebidas."
        ),
        "pois": [
            "Caseta de atención de alimentos",
            "Área de mesas cercana",
        ],
        "nav_hint": "Vuelve al pasillo de mesas o avanza hacia la biblioteca.",
    },
    {
        "file": "R0010079_202503281645_YP00145909.JPG",
        "id": "cultural-acceso",
        "zone": "cultural",
        "title": "Edificio Cultural — Acceso",
        "shortTitle": "Acceso cultural",
        "longDescription": (
            "Estás en el acceso al Edificio Cultural, junto a la biblioteca. "
            "Es un espacio de actividades artísticas y culturales del campus."
        ),
        "pois": [
            "Acceso al Edificio Cultural",
            "Proximidad a la biblioteca",
        ],
        "nav_hint": (
            "Puedes entrar al interior del edificio cultural o dirigirte "
            "a las puertas de la biblioteca."
        ),
    },
    {
        "file": "R0010081_202503281647_YP00145909.JPG",
        "id": "cultural-interior",
        "zone": "cultural",
        "title": "Edificio Cultural - Interior mural musical",
        "shortTitle": "Interior cultural",
        "longDescription": (
            "Estás en el interior del Edificio Cultural, frente a un mural musical. "
            "El espacio se usa para actividades culturales y encuentros."
        ),
        "pois": [
            "Mural musical",
            "Sala interior del edificio cultural",
        ],
        "nav_hint": "Regresa al acceso del edificio o continúa hacia la biblioteca.",
    },
    {
        "file": "R0010117_202503281724_YP00145909.JPG",
        "id": "patio-cancha",
        "zone": "patio",
        "title": "Patio C–D - Cubierta, cancha y escalera Bloque C",
        "shortTitle": "Patio cancha",
        "longDescription": (
            "Estás en el patio central entre los bloques C y D. "
            "Hay cubierta, cancha y escalera hacia el Bloque C."
        ),
        "pois": [
            "Cancha y zona cubierta",
            "Escalera del Bloque C",
        ],
        "nav_hint": (
            "Usa la lista de destinos para ir a la rampa accesible del patio "
            "o volver a los pasillos."
        ),
    },
    {
        "file": "R0010119_202503281725_YP00145909.JPG",
        "id": "patio-rampa",
        "zone": "patio",
        "title": "Patio C–D - Rampa accesible y zona abierta",
        "shortTitle": "Patio rampa",
        "longDescription": (
            "Estás en el patio C–D junto a la rampa accesible y la zona abierta. "
            "La rampa facilita el desplazamiento con movilidad reducida."
        ),
        "pois": [
            "Rampa accesible",
            "Zona abierta del patio",
        ],
        "nav_hint": "Puedes circular por el patio o regresar a pasillos del Bloque B.",
    },
    {
        "file": "R0010124_202503281730_YP00145909.JPG",
        "id": "salida-av3",
        "zone": "entrada",
        "title": "Pasillo Bloque B - Salida Av. 3",
        "shortTitle": "Salida Av. 3",
        "longDescription": (
            "Estás en el pasillo del Bloque B orientado hacia la salida a la Avenida 3. "
            "Es una salida secundaria del edificio."
        ),
        "pois": [
            "Salida hacia Avenida 3",
            "Pasillo del Bloque B",
        ],
        "nav_hint": "Regresa al hall o al patio según tu recorrido.",
    },
]

HOTSPOTS = [
    {
        "id": "punto-informacion",
        "sceneKey": "entrada-principal",
        "title": "Punto de información",
        "script": (
            "Punto de información. Está a la izquierda según la orientación de la "
            "entrada principal. Aquí puedes pedir horarios, ubicación de servicios "
            "estudiantiles y orientación general del campus Sede 2."
        ),
    },
    {
        "id": "acceso-accesible",
        "sceneKey": "entrada-principal",
        "title": "Acceso accesible",
        "script": (
            "Acceso accesible. Al frente de la entrada principal hay una rampa con "
            "barandas. La superficie es antideslizante y facilita el ingreso de "
            "personas con movilidad reducida hacia la puerta principal."
        ),
    },
    {
        "id": "mostrador-prestamo",
        "sceneKey": "biblioteca-lobby",
        "title": "Mostrador de préstamo",
        "script": (
            "Mostrador de préstamo de la Biblioteca Anita Bolívar de Consuegra. "
            "Aquí se realizan préstamos de libros, renovaciones y asesorías rápidas "
            "sobre recursos digitales. Pide orientación al personal bibliotecario."
        ),
    },
    {
        "id": "zona-estudio",
        "sceneKey": "biblioteca-lobby",
        "title": "Zona de estudio colaborativo",
        "script": (
            "Zona de estudio colaborativo en el lobby de la biblioteca. Hay mesas "
            "para trabajo en grupo, con vista hacia la mezanine. Desde aquí puedes "
            "continuar a cubículos, salones de vidrio o la colección general."
        ),
    },
    {
        # Must match biblioteca-scenes hotspot id (not a free-form label).
        "id": "82-rampa",
        "sceneKey": "pre-biblioteca-puertas",
        "title": "Rampa de acceso a biblioteca",
        "script": (
            "Rampa corta frente a las puertas de la biblioteca. Facilita el ingreso "
            "con movilidad reducida. El letrero BIBLIOTECA identifica el acceso a la "
            "Biblioteca Anita Bolívar de Consuegra."
        ),
    },
    {
        # Must match biblioteca-scenes hotspot id on control-ingreso-biblioteca.
        "id": "78-mostrador",
        "sceneKey": "control-ingreso-biblioteca",
        "title": "Recepción de bolsos y seguridad",
        "script": (
            "Mostrador de control de ingreso. Aquí se reciben bolsos y se hace el "
            "control de seguridad u objetos perdidos antes de entrar al lobby de la "
            "biblioteca."
        ),
    },
]

ZONE_LABELS = {
    "entrada": "Entrada y pasillos Bloque B",
    "cafeteria": "Cafetería y lobby común",
    "biblioteca_p1": "Biblioteca Anita Bolívar de Consuegra — Planta baja",
    "biblioteca_p2": "Biblioteca — Mezanine / nivel superior",
    "cultural": "Edificio Cultural",
    "patio": "Patio central entre Bloque C y D",
}


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[\s_]+", "-", value)
    return value.strip("-") or "escena"


def format_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0.0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"


def write_vtt(path: Path, cues: list[tuple[float, float, str]]) -> None:
    lines = ["WEBVTT", ""]
    for start, end, text in cues:
        # Ensure non-overlapping progressive cues
        if end <= start:
            end = start + 0.4
        lines.append(f"{format_timestamp(start)} --> {format_timestamp(end)}")
        lines.append(text.strip())
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def compose_scene_script(scene: dict, zone_key: str) -> str:
    zone_label = ZONE_LABELS.get(zone_key, zone_key.replace("_", " "))
    title = scene.get("title") or scene.get("shortTitle") or scene["id"]
    short = scene.get("shortTitle") or title
    long_desc = (scene.get("longDescription") or "").strip()
    pois = scene.get("pois")
    if not pois:
        hotspots = scene.get("hotspots") or []
        pois = []
        for h in hotspots:
            if not isinstance(h, dict):
                continue
            if h.get("type") == "info" and h.get("title"):
                desc = (h.get("description") or "").strip()
                if desc:
                    pois.append(f"{h['title']}: {desc}")
                else:
                    pois.append(h["title"])
            if len(pois) >= 4:
                break
    nav_hint = scene.get("nav_hint")
    if not nav_hint:
        links = scene.get("links") or []
        nav_labels = [l.get("label") for l in links if isinstance(l, dict) and l.get("label")]
        nav_hotspots = [
            h.get("title")
            for h in (scene.get("hotspots") or [])
            if isinstance(h, dict) and h.get("type") == "nav" and h.get("title")
        ]
        dests = nav_labels or nav_hotspots
        if dests:
            listed = "; ".join(dests[:4])
            nav_hint = (
                f"Para continuar sin usar el panorama, abre la lista de destinos "
                f"o puntos de interés. Destinos disponibles desde aquí: {listed}."
            )
        else:
            nav_hint = (
                "Para continuar sin usar el panorama, abre el menú de escenas "
                "o la lista de destinos y puntos de interés."
            )

    parts = [
        f"Escena: {title}.",
        f"Zona: {zone_label}.",
        f"Orientación. Estás en {short}.",
    ]
    if long_desc:
        parts.append(long_desc)
    if pois:
        parts.append("Puntos de interés principales.")
        for poi in pois[:4]:
            parts.append(poi if poi.endswith(".") else f"{poi}.")
    parts.append(nav_hint if nav_hint.endswith(".") else f"{nav_hint}.")
    parts.append(
        "Esta narración es temporal generada por voz artificial. "
        "Puede reemplazarse luego por una grabación humana usando el mismo guion."
    )
    return " ".join(p.strip() for p in parts if p and p.strip())


def write_script_md(path: Path, *, key: str, kind: str, title: str, zone: str, text: str, voice: str) -> None:
    path.write_text(
        "\n".join(
            [
                f"# Guion de narración — `{key}`",
                "",
                f"- **Tipo:** {kind}",
                f"- **Título:** {title}",
                f"- **Zona:** {zone}",
                f"- **Idioma:** es-CO",
                f"- **Voz TTS temporal:** {voice}",
                f"- **Archivo audio:** `{MEDIA_URL_PREFIX}/assets/audio/{'scenes' if kind == 'scene' else 'hotspots'}/{key}.mp3`",
                "",
                "## Instrucciones para locución humana",
                "",
                "- Tono claro, pausado, orientativo (no comercial).",
                "- Priorizar ubicación, qué es el espacio y cómo navegar.",
                "- Mantener nombres propios (Unisimón, Biblioteca Anita Bolívar de Consuegra).",
                "- Reemplazar el MP3 generado por TTS conservando la misma ruta de archivo.",
                "",
                "## Texto para leer",
                "",
                text,
                "",
            ]
        ),
        encoding="utf-8",
    )


def write_timing_json(
    path: Path,
    *,
    key: str,
    kind: str,
    cues: list[tuple[float, float, str]],
    source: str = "tts",
) -> None:
    sub = "scenes" if kind == "scene" else "hotspots"
    id_field = "sceneKey" if kind == "scene" else "hotspotId"
    duration = round(cues[-1][1], 3) if cues else None
    payload = {
        id_field: key,
        "locale": "es-CO",
        "durationSec": duration,
        "source": source,
        "audioFile": f"{MEDIA_URL_PREFIX}/assets/audio/{sub}/{key}.mp3",
        "transcriptFile": f"{MEDIA_URL_PREFIX}/assets/transcripts/{sub}/{key}.txt",
        "captionFile": f"{MEDIA_URL_PREFIX}/assets/captions/{sub}/{key}.vtt",
        "scriptFile": f"{MEDIA_URL_PREFIX}/assets/accessibility/scripts/{sub}/{key}.md",
        "cues": [
            {
                "startSec": round(start, 3),
                "endSec": round(end, 3),
                "text": text,
            }
            for start, end, text in cues
        ],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def synthesize(text: str, mp3_path: Path, vtt_path: Path, voice: str, rate: str) -> list[tuple[float, float, str]]:
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    cues: list[tuple[float, float, str]] = []
    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    with mp3_path.open("wb") as audio_file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_file.write(chunk["data"])
            elif chunk["type"] == "SentenceBoundary":
                start = chunk["offset"] / 10_000_000
                end = (chunk["offset"] + chunk["duration"]) / 10_000_000
                cues.append((start, end, chunk["text"]))
    if not cues:
        # Fallback single cue from approximate duration if boundaries missing
        approx = max(1.5, len(text.split()) / 2.4)
        cues = [(0.0, approx, text)]
    write_vtt(vtt_path, cues)
    return cues


def load_scenes() -> tuple[list[dict], dict]:
    config = json.loads((TENANT / "config.json").read_text(encoding="utf-8"))
    biblio = json.loads((TENANT / "biblioteca-scenes.json").read_text(encoding="utf-8"))
    file_to_zone = {s["file"]: s.get("zone", "general") for s in config.get("scenes", [])}

    scenes: list[dict] = []
    seen: set[str] = set()

    for extra in CAMPUS_EXTRA:
        item = dict(extra)
        item["zoneKey"] = extra["zone"]
        scenes.append(item)
        seen.add(extra["id"])

    for file_key, scene in biblio.items():
        sid = scene.get("id") or slugify(scene.get("title") or file_key)
        if sid in seen:
            continue
        item = dict(scene)
        item["id"] = sid
        item["file"] = file_key
        item["zoneKey"] = file_to_zone.get(file_key, "biblioteca_p1")
        scenes.append(item)
        seen.add(sid)

    return scenes, config


async def generate_item(
    *,
    key: str,
    kind: str,
    title: str,
    zone: str,
    text: str,
    voice: str,
    rate: str,
    dry_run: bool,
) -> dict:
    sub = "scenes" if kind == "scene" else "hotspots"
    audio = ASSETS / "audio" / sub / f"{key}.mp3"
    transcript = ASSETS / "transcripts" / sub / f"{key}.txt"
    captions = ASSETS / "captions" / sub / f"{key}.vtt"
    # Canonical Phase 3 path (also mirrored under assets/scripts for legacy readers).
    script = ASSETS / "accessibility" / "scripts" / sub / f"{key}.md"
    script_legacy = ASSETS / "scripts" / sub / f"{key}.md"
    timing = ASSETS / "accessibility" / "timing" / sub / f"{key}.json"

    for p in (
        audio.parent,
        transcript.parent,
        captions.parent,
        script.parent,
        script_legacy.parent,
        timing.parent,
    ):
        p.mkdir(parents=True, exist_ok=True)

    transcript.write_text(text + "\n", encoding="utf-8")
    write_script_md(script, key=key, kind=kind, title=title, zone=zone, text=text, voice=voice)
    write_script_md(
        script_legacy, key=key, kind=kind, title=title, zone=zone, text=text, voice=voice
    )

    meta = {
        "key": key,
        "kind": kind,
        "title": title,
        "zone": zone,
        "voice": voice,
        "text": text,
        "paths": {
            "audio": "/" + str(audio.relative_to(ROOT)).replace("\\", "/"),
            "transcript": "/" + str(transcript.relative_to(ROOT)).replace("\\", "/"),
            "captions": "/" + str(captions.relative_to(ROOT)).replace("\\", "/"),
            "script": "/" + str(script.relative_to(ROOT)).replace("\\", "/"),
            "timing": "/" + str(timing.relative_to(ROOT)).replace("\\", "/"),
        },
    }

    if dry_run:
        # Estimated VTT from ~2.4 words/sec
        words = text.split()
        cues = []
        t = 0.0
        # Split into ~12-word chunks for estimate
        for i in range(0, len(words), 12):
            chunk_words = words[i : i + 12]
            chunk = " ".join(chunk_words)
            dur = max(0.8, len(chunk_words) / 2.4)
            cues.append((t, t + dur, chunk))
            t += dur
        write_vtt(captions, cues)
        write_timing_json(timing, key=key, kind=kind, cues=cues, source="tts-estimate")
        meta["dryRun"] = True
        meta["durationEstimateSec"] = round(t, 2)
        return meta

    cues = await synthesize(text, audio, captions, voice, rate)
    write_timing_json(timing, key=key, kind=kind, cues=cues, source="tts")
    duration = cues[-1][1] if cues else 0.0
    meta["durationSec"] = round(duration, 2)
    meta["cueCount"] = len(cues)
    return meta


def patch_configs(scene_metas: list[dict], hotspot_metas: list[dict]) -> None:
    """Wire real asset paths into config.json and biblioteca-scenes.json."""
    config_path = TENANT / "config.json"
    biblio_path = TENANT / "biblioteca-scenes.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    biblio = json.loads(biblio_path.read_text(encoding="utf-8"))

    scene_by_key = {m["key"]: m for m in scene_metas}
    hotspot_by_key = {m["key"]: m for m in hotspot_metas}

    # Patch accessibleScenes in config (entrada + legacy biblioteca-principal alias)
    accessible = config.setdefault("accessibleScenes", {})
    for file_key, scene in list(accessible.items()):
        sid = scene.get("id")
        # Map legacy biblioteca-principal → biblioteca-lobby assets
        asset_key = "biblioteca-lobby" if sid == "biblioteca-principal" else sid
        meta = scene_by_key.get(asset_key) or scene_by_key.get(sid or "")
        if not meta:
            continue
        scene["narration"] = meta["paths"]["audio"]
        scene["transcript"] = meta["paths"]["transcript"]
        scene["captionFile"] = meta["paths"]["captions"]
        scene["scriptFile"] = meta["paths"]["script"]
        if meta["paths"].get("timing"):
            scene["timingFile"] = meta["paths"]["timing"]
        for hs in scene.get("hotspots") or []:
            hid = hs.get("id")
            hm = hotspot_by_key.get(hid or "")
            if hm:
                hs["narration"] = hm["paths"]["audio"]
                hs["transcript"] = hm["paths"]["transcript"]
                hs["captionFile"] = hm["paths"]["captions"]
                hs["scriptFile"] = hm["paths"]["script"]
                if hm["paths"].get("timing"):
                    hs["timingFile"] = hm["paths"]["timing"]

    # Patch every biblioteca scene
    for file_key, scene in biblio.items():
        sid = scene.get("id")
        meta = scene_by_key.get(sid or "")
        if not meta:
            continue
        scene["narration"] = meta["paths"]["audio"]
        scene["transcript"] = meta["paths"]["transcript"]
        scene["captionFile"] = meta["paths"]["captions"]
        scene["scriptFile"] = meta["paths"]["script"]
        if meta["paths"].get("timing"):
            scene["timingFile"] = meta["paths"]["timing"]

    # Also ensure campus extras appear under accessibleScenes with a11y paths
    # (entrada already there; add lightweight stubs for other campus picks if missing)
    file_to_meta = {}
    for m in scene_metas:
        # recover file from manifest later; build from CAMPUS_EXTRA + biblio
        pass

    extras_by_file = {e["file"]: e for e in CAMPUS_EXTRA}
    for file_key, extra in extras_by_file.items():
        meta = scene_by_key.get(extra["id"])
        if not meta:
            continue
        current = accessible.get(file_key) or {}
        if current.get("id") and current.get("id") != extra["id"] and file_key in biblio:
            continue
        accessible[file_key] = {
            **current,
            "id": extra["id"],
            "title": current.get("title") or extra["title"],
            "shortTitle": current.get("shortTitle") or extra.get("shortTitle"),
            "altText": current.get("altText")
            or f"Vista 360° de {extra.get('shortTitle') or extra['title']}.",
            "longDescription": current.get("longDescription") or extra.get("longDescription"),
            "narration": meta["paths"]["audio"],
            "transcript": meta["paths"]["transcript"],
            "captionFile": meta["paths"]["captions"],
            "scriptFile": meta["paths"]["script"],
            "hotspots": current.get("hotspots") or [],
            "links": current.get("links") or [],
        }
        # Wire entrada hotspots already defined
        for hs in accessible[file_key].get("hotspots") or []:
            hid = hs.get("id")
            hm = hotspot_by_key.get(hid or "")
            if hm:
                hs["narration"] = hm["paths"]["audio"]
                hs["transcript"] = hm["paths"]["transcript"]
                hs["captionFile"] = hm["paths"]["captions"]
                hs["scriptFile"] = hm["paths"]["script"]

    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    biblio_path.write_text(json.dumps(biblio, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Orbe360 a11y TTS assets")
    parser.add_argument("--voice", default=VOICE)
    parser.add_argument("--rate", default=RATE)
    parser.add_argument("--dry-run", action="store_true", help="Scripts+VTT estimates only, no network TTS")
    parser.add_argument("--only", default="", help="Comma-separated keys to generate")
    parser.add_argument("--skip-config-patch", action="store_true")
    args = parser.parse_args()

    only = {k.strip() for k in args.only.split(",") if k.strip()}
    scenes, _config = load_scenes()

    scene_metas: list[dict] = []
    hotspot_metas: list[dict] = []

    print(f"Voice: {args.voice} | rate: {args.rate} | scenes: {len(scenes)} | hotspots: {len(HOTSPOTS)}")
    if args.dry_run:
        print("DRY RUN: no audio synthesis")

    for scene in scenes:
        key = scene["id"]
        if only and key not in only:
            continue
        zone_key = scene.get("zoneKey") or scene.get("zone") or "general"
        zone_label = ZONE_LABELS.get(zone_key, zone_key)
        text = compose_scene_script(scene, zone_key)
        print(f"  [scene] {key} ...", flush=True)
        meta = await generate_item(
            key=key,
            kind="scene",
            title=scene.get("title") or key,
            zone=zone_label,
            text=text,
            voice=args.voice,
            rate=args.rate,
            dry_run=args.dry_run,
        )
        scene_metas.append(meta)

    for hs in HOTSPOTS:
        key = hs["id"]
        if only and key not in only:
            continue
        print(f"  [hotspot] {key} ...", flush=True)
        meta = await generate_item(
            key=key,
            kind="hotspot",
            title=hs["title"],
            zone=hs.get("sceneKey", ""),
            text=hs["script"],
            voice=args.voice,
            rate=args.rate,
            dry_run=args.dry_run,
        )
        hotspot_metas.append(meta)

    manifest = {
        "tool": "edge-tts",
        "voice": args.voice,
        "rate": args.rate,
        "licenseNote": (
            "edge-tts uses Microsoft Edge online neural voices. Suitable as temporary "
            "production placeholders; replace with human recordings for final release "
            "per institutional policy."
        ),
        "scenes": scene_metas,
        "hotspots": hotspot_metas,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if not args.skip_config_patch and not only:
        # When filtering --only, still patch if we have metas
        patch_configs(scene_metas, hotspot_metas)
        print("Updated config.json and biblioteca-scenes.json narration paths.")
    elif not args.skip_config_patch and (scene_metas or hotspot_metas):
        # Partial patch for --only
        patch_configs(scene_metas, hotspot_metas)
        print("Patched config paths for generated keys.")

    # Cleanup probes if present
    for probe in ASSETS.glob("_tts_probe*"):
        probe.unlink(missing_ok=True)

    print(
        f"Done. Generated {len(scene_metas)} scenes + {len(hotspot_metas)} hotspots "
        f"({(len(scene_metas) + len(hotspot_metas)) * 4} files). Manifest: {MANIFEST_PATH.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

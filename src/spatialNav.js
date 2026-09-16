/**
 * Grafo espacial para navegación tipo Google Street View / Maps.
 * Une secuencia de captura + hotspots nav explícitos + puentes conocidos del campus.
 */

function ricohNumber(file) {
  const match = /R0010(\d{3})_/.exec(file || '');
  return match ? Number(match[1]) : 0;
}

function shortestAngleDiff(a, b) {
  let diff = (a - b + Math.PI) % (2 * Math.PI) - Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

/**
 * Enriquecer navigationHotspots de cada escena.
 *
 * @param {object[]} scenes
 * @param {{ autoNeighbors?: boolean }} [options]
 *   autoNeighbors (default true): seq/orbit/bridges del piloto estático.
 *   Cuando Convex es SoT (`__convexGraphLoaded`), pasar autoNeighbors:false
 *   para que borrar conexiones en admin elimine cue/doble-clic fantasma.
 */
export function enrichSpatialGraph(scenes, options = {}) {
  const autoNeighbors = options.autoNeighbors !== false;
  const byFile = new Map(scenes.map((s) => [s.file, s]));
  const sorted = [...scenes].sort((a, b) => ricohNumber(a.file) - ricohNumber(b.file));

  if (autoNeighbors) {
    // Vecinos por secuencia de captura (flujo lineal de las fotos)
    sorted.forEach((scene, index) => {
      const prev = sorted[index - 1];
      const next = sorted[index + 1];
      ensureNavList(scene);

      // Secuencia de captura: peso bajo (las flechas laterales cubren prev/next;
      // el doble clic prioriza hotspots visibles y puentes con yaw real).
      if (next) {
        pushUnique(scene.navigationHotspots, {
          id: `${scene.id}-seq-next`,
          title: `Avanzar: ${next.shortTitle || next.title}`,
          yaw: 0,
          pitch: -0.08,
          target: next.id,
          weight: 0.55
        });
      }
      if (prev) {
        pushUnique(scene.navigationHotspots, {
          id: `${scene.id}-seq-prev`,
          title: `Volver: ${prev.shortTitle || prev.title}`,
          yaw: Math.PI,
          pitch: -0.08,
          target: prev.id,
          weight: 0.55
        });
      }

      // Órbitas cercanas (fotos alrededor del mismo punto)
      const near = sorted.filter((other, i) => {
        if (other.id === scene.id) return false;
        const dn = Math.abs(ricohNumber(other.file) - ricohNumber(scene.file));
        const di = Math.abs(i - index);
        return dn <= 2 && di <= 2;
      });
      near.forEach((other, i) => {
        const sideYaw = (i % 2 === 0 ? 1 : -1) * (Math.PI / 2.4);
        pushUnique(scene.navigationHotspots, {
          id: `${scene.id}-orbit-${other.id}`,
          title: other.shortTitle || other.title,
          yaw: sideYaw,
          pitch: -0.05,
          target: other.id,
          weight: 0.75
        });
      });
    });

    // Puentes conocidos del campus (análisis visual del piloto)
    const bridges = [
      // Cafetería ↔ biblioteca
      bridge(byFile, 'R0010076_202503281642_YP00145909.JPG', 'R0010082_202503281648_YP00145909.JPG', -0.9, 'Hacia biblioteca'),
      bridge(byFile, 'R0010078_202503281644_YP00145909.JPG', 'R0010082_202503281648_YP00145909.JPG', 0.35, 'Puertas biblioteca'),
      bridge(byFile, 'R0010082_202503281648_YP00145909.JPG', 'R0010083_202503281649_YP00145909.JPG', -0.55, 'Entrar biblioteca'),
      bridge(byFile, 'R0010083_202503281649_YP00145909.JPG', 'R0010082_202503281648_YP00145909.JPG', Math.PI, 'Salir a lobby'),
      // Cultural contiguo a biblioteca / calle 14
      bridge(byFile, 'R0010079_202503281645_YP00145909.JPG', 'R0010081_202503281647_YP00145909.JPG', -0.4, 'Edificio Cultural'),
      bridge(byFile, 'R0010081_202503281647_YP00145909.JPG', 'R0010079_202503281645_YP00145909.JPG', Math.PI, 'Salir del Cultural'),
      bridge(byFile, 'R0010079_202503281645_YP00145909.JPG', 'R0010078_202503281644_YP00145909.JPG', 1.2, 'Control biblioteca'),
      bridge(byFile, 'R0010080_202503281646_YP00145909.JPG', 'R0010079_202503281645_YP00145909.JPG', 0.2, 'Entrar sede / Cultural'),
      // Hall ↔ cómputo / descanso
      bridge(byFile, 'R0010065_202503281501_YP00145909.JPG', 'R0010066_202503281503_YP00145909.JPG', 0.1, 'Zona descanso'),
      bridge(byFile, 'R0010066_202503281503_YP00145909.JPG', 'R0010067_202503281505_YP00145909.JPG', 0.4, 'Escaleras Bloque B'),
      // Patio C–D (separado del Cultural)
      bridge(byFile, 'R0010117_202503281724_YP00145909.JPG', 'R0010118_202503281724_YP00145909.JPG', 0.2, 'Patio'),
      bridge(byFile, 'R0010121_202503281727_YP00145909.JPG', 'R0010117_202503281724_YP00145909.JPG', Math.PI, 'Cubierta Bloque C')
    ];

    bridges.forEach((item) => {
      if (!item) return;
      ensureNavList(item.scene);
      pushUnique(item.scene.navigationHotspots, item.hotspot);
    });
  }

  // Incorporar hotspots nav visibles al grafo (ya tienen yaw real)
  scenes.forEach((scene) => {
    ensureNavList(scene);
    (scene.hotspots || []).forEach((hotspot) => {
      if (hotspot.type !== 'nav' || !hotspot.target) return;
      pushUnique(scene.navigationHotspots, {
        id: `${hotspot.id}-spatial`,
        title: hotspot.title,
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
        target: hotspot.target,
        weight: 1.4
      });
    });
  });
}

function bridge(byFile, fromFile, toFile, yaw, title) {
  const from = byFile.get(fromFile);
  const to = byFile.get(toFile);
  if (!from || !to) return null;
  return {
    scene: from,
    hotspot: {
      id: `${from.id}-bridge-${to.id}`,
      title: title || to.shortTitle || to.title,
      yaw,
      pitch: -0.08,
      target: to.id,
      weight: 1.3
    }
  };
}

function ensureNavList(scene) {
  if (!Array.isArray(scene.navigationHotspots)) {
    scene.navigationHotspots = [];
  }
}

function pushUnique(list, hotspot) {
  const exists = list.some(
    (item) =>
      item.target === hotspot.target &&
      Math.abs(shortestAngleDiff(item.yaw, hotspot.yaw)) < 0.25
  );
  if (!exists) list.push(hotspot);
}

/**
 * Elige el destino espacial más cercano a la dirección del puntero.
 * options.previousSceneId penaliza el retorno inmediato (anti-bucle).
 * options.coneRadians limita el cono de visión (default ~55°).
 */
export function pickSpatialTarget(navigationHotspots, yaw, pitch, maxScore = 1.05, options = {}) {
  if (!Array.isArray(navigationHotspots) || navigationHotspots.length === 0) return null;

  const previousSceneId = options.previousSceneId || null;
  const cone = typeof options.coneRadians === 'number' ? options.coneRadians : 0.95;
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;

  navigationHotspots.forEach((target) => {
    const yawDiff = shortestAngleDiff(yaw, target.yaw);
    const pitchDiff = pitch - (target.pitch || 0);
    if (Math.abs(yawDiff) > cone && Math.abs(pitchDiff) < 0.35) {
      // Fuera del cono horizontal (salvo miradas fuertes arriba/abajo)
      if (Math.abs(pitch) < 0.28) return;
    }

    let weight = Math.max(0.35, target.weight || 1);
    // Penalizar volver a la escena anterior salvo que mires claramente hacia atrás
    if (previousSceneId && target.target === previousSceneId) {
      const lookingBack = Math.abs(Math.abs(yawDiff) - Math.PI) < 0.7 || Math.abs(yawDiff) > 2.0;
      weight *= lookingBack ? 0.95 : 0.35;
    }

    const score = (Math.abs(yawDiff) + Math.abs(pitchDiff) * 0.55) / weight;
    if (score < bestScore) {
      bestScore = score;
      best = { target, yawDiff, pitchDiff, score };
    }
  });

  if (!best || best.score > maxScore) return null;
  return best;
}

export { shortestAngleDiff, ricohNumber };

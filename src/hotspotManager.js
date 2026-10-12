import { announceHotspot } from './announcer.js';
import { appState, getSetting, selectors } from './state.js';
import { getOverridesForScene, isEditMode, saveOverride } from './hotspotEditing.js';
import { hotspotIconHtml, hotspotCategoryMeta } from './hotspotIcons.js';

const ACTIVE_CLASS = 'hotspot--active';

let activeHotspotId = null;
let hotspotControls = [];
let dragState = null;
let activeContainer = null;

export function clearHotspots() {
  // Preferir API nativa de Marzipano para no dejar nodos huérfanos en el render loop
  if (activeContainer && typeof activeContainer.listHotspots === 'function') {
    const listed = activeContainer.listHotspots().slice();
    listed.forEach((hotspot) => {
      try {
        if (typeof activeContainer.destroyHotspot === 'function') {
          activeContainer.destroyHotspot(hotspot);
        } else if (typeof hotspot.destroy === 'function') {
          hotspot.destroy();
        }
      } catch (error) {
        console.warn('No se pudo destruir hotspot de contenedor', error);
      }
    });
  } else {
    hotspotControls.forEach(({ control }) => {
      try {
        control?.destroy?.();
      } catch (error) {
        console.warn('No se pudo destruir un hotspot', error);
      }
    });
  }

  hotspotControls = [];
  activeHotspotId = null;
  activeContainer = null;
}

export function renderHotspots(sceneData, marzipanoScene, options = {}) {
  const { onOpenHotspot, onNavigateScene } = options;
  clearHotspots();

  applyStoredOverrides(sceneData);

  const container = marzipanoScene.hotspotContainer();
  activeContainer = container;

  (sceneData.hotspots || []).forEach((hotspot) => {
    const button = createHotspotButton({
      sceneData,
      hotspot,
      onOpenHotspot,
      onNavigateScene
    });

    const control = container.createHotspot(button, {
      yaw: hotspot.yaw,
      pitch: hotspot.pitch
    });

    hotspotControls.push({ control, sceneId: sceneData.id, hotspot });
    registerEditableBehavior(button, control, sceneData, hotspot, marzipanoScene);
  });
}

export function focusFirstHotspot() {
  const quickButton = document.querySelector('.hotspot-inline-button--featured');
  if (quickButton instanceof HTMLElement) {
    quickButton.focus();
    return;
  }
  const hotspot = document.querySelector('.hotspot');
  if (hotspot instanceof HTMLElement) {
    hotspot.focus();
  }
}

export function setActiveHotspot(hotspotId) {
  activeHotspotId = hotspotId;
  document.querySelectorAll('.hotspot').forEach((element) => {
    if (element.dataset.hotspotId === hotspotId) {
      element.classList.add(ACTIVE_CLASS);
      element.setAttribute('aria-pressed', 'true');
    } else {
      element.classList.remove(ACTIVE_CLASS);
      element.setAttribute('aria-pressed', 'false');
    }
  });
}

function applyStoredOverrides(sceneData) {
  const overrides = getOverridesForScene(sceneData.id);
  sceneData.hotspots.forEach((hotspot) => {
    const override = overrides[hotspot.id];
    if (override) {
      hotspot.yaw = override.yaw;
      hotspot.pitch = override.pitch;
    }
  });
}

function createHotspotButton({ sceneData, hotspot, onOpenHotspot, onNavigateScene }) {
  const button = document.createElement('button');
  button.type = 'button';
  const hotspotType = hotspot.type || 'info';
  button.className = `hotspot hotspot--${hotspotType}`;
  button.dataset.hotspotId = hotspot.id;
  button.dataset.hotspotType = hotspotType;
  if (hotspot.iconKey) button.dataset.iconKey = hotspot.iconKey;
  if (hotspot.category) button.dataset.category = hotspot.category;
  if (hotspot.animationPreset && hotspot.animationPreset !== 'none') {
    button.classList.add(`hotspot--anim-${hotspot.animationPreset}`);
  }
  if (hotspotType === 'nav' && hotspot.target) {
    button.dataset.targetId = hotspot.target;
  }
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('aria-label', hotspot.title);
  button.setAttribute('aria-describedby', getDescriptionId(sceneData, hotspot));
  button.setAttribute('aria-pressed', 'false');

  const chip = document.createElement('span');
  chip.className = 'hotspot__chip';

  const categoryMeta = hotspotCategoryMeta(hotspot.category);
  const accent =
    (typeof hotspot.accentColor === 'string' && hotspot.accentColor.trim()) ||
    categoryMeta?.color ||
    null;
  if (accent) {
    button.style.setProperty('--hotspot-accent', accent);
  }

  const icon = document.createElement('span');
  icon.className = 'hotspot__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = hotspotIconHtml(
    hotspotType === 'nav' ? 'nav' : 'info',
    hotspot.iconKey
  );
  chip.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'hotspot__label';
  label.textContent = hotspot.shortLabel || hotspot.title;
  chip.appendChild(label);
  button.appendChild(chip);

  if (hotspotType === 'nav') {
    const preview = document.createElement('div');
    preview.className = 'hotspot-preview';
    preview.setAttribute('aria-hidden', 'true');

    const viewport = document.createElement('div');
    viewport.className = 'hotspot-preview__viewport';

    const targetScene = resolveTargetScene(hotspot.target);
    if (targetScene?.file || targetScene?.imageUrl) {
      const thumb = document.createElement('img');
      thumb.className = 'hotspot-preview__thumb';
      const org =
        typeof window !== 'undefined' && window.__ORBE_ORG_SLUG__
          ? String(window.__ORBE_ORG_SLUG__).toLowerCase()
          : 'unisimoncucuta';
      const tour =
        typeof window !== 'undefined' && window.__ORBE_TOUR_SLUG__
          ? String(window.__ORBE_TOUR_SLUG__).toLowerCase()
          : 'experienciavirtual';
      thumb.src =
        targetScene.imageUrl &&
        (/^https?:\/\//i.test(targetScene.imageUrl) ||
          targetScene.imageUrl.startsWith('/') ||
          targetScene.imageUrl.includes('/'))
          ? targetScene.imageUrl
          : `/media/${org}/${tour}/panoramas/${targetScene.file}`;
      thumb.alt = '';
      thumb.loading = 'lazy';
      // Map nav yaw → horizontal crop so preview reads as tour framing, not a strip
      const yaw = typeof hotspot.yaw === 'number' ? hotspot.yaw : 0;
      const yawPct = 50 + (yaw / Math.PI) * 42;
      thumb.style.setProperty('--preview-yaw', `${Math.max(8, Math.min(92, yawPct))}%`);
      viewport.appendChild(thumb);
    }

    const caption = document.createElement('span');
    caption.className = 'hotspot-preview__caption';
    caption.textContent = `Ir a: ${targetScene?.shortTitle || hotspot.title}`;
    viewport.appendChild(caption);
    preview.appendChild(viewport);
    button.appendChild(preview);
  }

  const srDescription = document.createElement('span');
  srDescription.id = getDescriptionId(sceneData, hotspot);
  srDescription.className = 'sr-only';
  srDescription.textContent = hotspot.altText || hotspot.description || hotspot.title;
  button.appendChild(srDescription);

  const handleActivate = () => {
    if (isEditMode()) return;
    setActiveHotspot(hotspot.id);

    if (hotspotType === 'nav' && hotspot.target && typeof onNavigateScene === 'function') {
      announceHotspot(`Navegando a: ${hotspot.title}`);
      if (appState?.accessibleMode && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(`Navegando a: ${hotspot.title}`);
        utter.lang = 'es-ES';
        window.speechSynthesis.speak(utter);
      }
      onNavigateScene(hotspot.target, { transition: true });
      return;
    }

    if (typeof onOpenHotspot === 'function') {
      announceHotspot(`Hotspot abierto: ${hotspot.title}`);
      onOpenHotspot(sceneData, hotspot, {
        autoNarration: true,
        focusPanel: true
      });
    }
  };

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleActivate();
  });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  });

  return button;
}

function registerEditableBehavior(button, control, sceneData, hotspot, marzipanoScene) {
  button.addEventListener('pointerdown', (event) => {
    if (!isEditMode() || event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    dragState = {
      pointerId: event.pointerId,
      control,
      hotspot,
      sceneId: sceneData.id,
      marzipanoScene
    };
  });

  button.addEventListener('pointermove', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const coords = screenToCoordinates(event, dragState.marzipanoScene);
    if (!coords) return;
    dragState.control.setPosition(coords);
    dragState.hotspot.yaw = coords.yaw;
    dragState.hotspot.pitch = coords.pitch;
  });

  const finishDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    try {
      button.releasePointerCapture(event.pointerId);
    } catch (_) {
      /* noop */
    }
    saveOverride(dragState.sceneId, dragState.hotspot.id, dragState.hotspot.yaw, dragState.hotspot.pitch);
    announceHotspot(`Hotspot "${dragState.hotspot.title}" reubicado.`);
    dragState = null;
  };

  button.addEventListener('pointerup', finishDrag);
  button.addEventListener('pointercancel', finishDrag);
}

function screenToCoordinates(event, marzipanoScene) {
  const panorama = selectors.panorama();
  if (!panorama) return null;
  const rect = panorama.getBoundingClientRect();
  const view = marzipanoScene.view();
  if (!view || typeof view.screenToCoordinates !== 'function') {
    return null;
  }
  const coords = view.screenToCoordinates({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  });
  return coords;
}

function getDescriptionId(sceneData, hotspot) {
  return `hotspot-desc-${sceneData.id}-${hotspot.id}`;
}

function resolveTargetScene(targetId) {
  if (!targetId || !appState?.config?.scenes) return null;
  return appState.config.scenes.find((scene) => scene.id === targetId) || null;
}

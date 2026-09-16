/**
 * Un solo panel/menú abierto a la vez (jerarquía UX).
 * Escape / backdrop deben parar audio vía mediaSession (misma ruta que closePanel).
 *
 * Accesibilidad del cajón de escenas: abrir/cerrar vive SOLO aquí para que el
 * foco y el estado `inert` no se puedan desincronizar entre menu.js, main.js y
 * los cierres globales (Escape / backdrop / pointerdown fuera).
 */
import { stopActiveMedia } from './mediaSession.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Enfocables realmente alcanzables (no dentro de `hidden`, no de tamaño cero). */
export function visibleFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => {
    if (el.closest('[hidden]') || el.closest('[inert]')) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    // Un input de interruptor es transparente pero sí es enfocable y visible.
    return el.getClientRects().length > 0 || style.opacity === '0';
  });
}

/** Ciclo de Tab dentro de un contenedor (paneles modales). */
export function trapFocusWithin(container, event) {
  const items = visibleFocusable(container);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

export function closeAllLayers(except = null) {
  if (except !== 'sceneMenu') closeSceneMenu();
  if (except !== 'accessibility') closeAccessibilityMenu();
  if (except !== 'hotspot') closeHotspotPanelDom();
  if (except !== 'help') closeDialog('helpDialog');
  if (except !== 'share') closeDialog('shareDialog');
  if (except !== 'keyboardHint') {
    const hint = document.getElementById('keyboardInstructions');
    if (hint) {
      hint.setAttribute('hidden', '');
      hint.removeAttribute('data-manual');
    }
  }
  updateBackdrop(except);
}

export function openExclusive(layer) {
  closeAllLayers(layer);
  updateBackdrop(layer);
}

function updateBackdrop(activeLayer) {
  const backdrop = document.getElementById('uiBackdrop');
  if (!backdrop) return;
  const needsBackdrop = activeLayer === 'sceneMenu'
    || activeLayer === 'accessibility'
    || activeLayer === 'hotspot';
  if (needsBackdrop) {
    backdrop.removeAttribute('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('ui-backdrop--visible');
    backdrop.dataset.layer = activeLayer;
  } else {
    backdrop.setAttribute('hidden', '');
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('ui-backdrop--visible');
    backdrop.dataset.layer = '';
  }
}

/** Cierra un panel concreto y limpia el backdrop si no queda ninguno. */
export function dismissOpenLayers() {
  closeAllLayers();
}

/* En teléfono el cajón va a sangre completa (responsive.css, ≤720px) y tapa el
   visor: ahí es un modal y el visor debe quedar `inert`, porque si no el Tab
   seguía recorriendo flechas y chips invisibles debajo del cajón. En escritorio
   el cajón es un panel lateral y el visor sigue siendo utilizable, así que NO se
   marca inert (bloquearía el arrastre del panorama). */
const FULL_BLEED_DRAWER = '(max-width: 720px)';
export const drawerIsModal = () => window.matchMedia(FULL_BLEED_DRAWER).matches;

/** Abre el cajón de escenas y lleva el foco dentro. */
export function openSceneMenu({ focusTarget = 'first' } = {}) {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('sceneMenu');
  if (!toggle || !menu) return;

  closeAllLayers('sceneMenu');
  updateBackdrop('sceneMenu');

  toggle.setAttribute('aria-expanded', 'true');
  menu.classList.add('scene-menu--open');
  menu.removeAttribute('inert');
  menu.removeAttribute('aria-hidden');

  const viewer = document.getElementById('viewerSection');
  if (viewer && drawerIsModal()) viewer.setAttribute('inert', '');

  if (focusTarget === 'none') return;
  requestAnimationFrame(() => {
    const target =
      focusTarget instanceof HTMLElement
        ? focusTarget
        : visibleFocusable(menu)[0];
    if (target) target.focus();
  });
}

function closeSceneMenu() {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('sceneMenu');
  if (!toggle || !menu) return;

  const wasOpen = menu.classList.contains('scene-menu--open');
  const focusWasInside = menu.contains(document.activeElement);

  toggle.setAttribute('aria-expanded', 'false');
  menu.classList.remove('scene-menu--open');
  /* `inert` + `aria-hidden` sobre el cajón cerrado: el CSS ya lo saca del orden
     de tabulación con `visibility: hidden`, esto lo saca también del árbol de
     accesibilidad en navegadores que no propagan la visibilidad. */
  menu.setAttribute('inert', '');
  menu.setAttribute('aria-hidden', 'true');

  const viewer = document.getElementById('viewerSection');
  if (viewer) viewer.removeAttribute('inert');

  // Si el foco estaba dentro del cajón, devolverlo al disparador (WCAG 2.4.3):
  // de lo contrario el foco cae al <body> y el usuario pierde el hilo.
  if (wasOpen && focusWasInside) toggle.focus();
}

/** Estado inicial coherente del cajón (cerrado ⇒ inert). */
export function initSceneMenuState() {
  const menu = document.getElementById('sceneMenu');
  if (!menu) return;
  if (!menu.classList.contains('scene-menu--open')) {
    menu.setAttribute('inert', '');
    menu.setAttribute('aria-hidden', 'true');
  }
}

function closeAccessibilityMenu() {
  const toggle = document.getElementById('accessibilityToggle');
  const panel = document.getElementById('accessibilityMenu');
  if (!toggle || !panel) return;
  toggle.setAttribute('aria-expanded', 'false');
  panel.setAttribute('hidden', 'hidden');
  panel.classList.remove('accessibility-menu--open');
}

function closeHotspotPanelDom() {
  // Unify with hotspotPanel.closePanel: always stop media first.
  stopActiveMedia();
  const panel = document.getElementById('hotspotPanel');
  if (!panel) return;
  panel.setAttribute('hidden', 'hidden');
  panel.setAttribute('aria-hidden', 'true');
  panel.classList.remove('hotspot-panel--open');
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && typeof dialog.close === 'function' && dialog.open) {
    dialog.close();
  }
}

export function bindGlobalUiGuards() {
  const backdrop = document.getElementById('uiBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (event) => {
      // Sólo cerrar si el toque fue en el backdrop, no en un panel encima.
      if (event.target === backdrop) {
        closeAllLayers();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllLayers();
    }
  });

  document.addEventListener('pointerdown', (event) => {
    const menu = document.getElementById('sceneMenu');
    const toggle = document.getElementById('menuToggle');
    if (!menu?.classList.contains('scene-menu--open')) return;
    const target = event.target;
    if (target instanceof Node && (menu.contains(target) || toggle?.contains(target))) return;
    if (target instanceof Element && target.id === 'uiBackdrop') return;
    closeSceneMenu();
    updateBackdrop(null);
  });
}

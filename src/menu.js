import {
  dismissOpenLayers,
  openSceneMenu,
  initSceneMenuState,
  trapFocusWithin,
  drawerIsModal,
} from './uiLayers.js';

export function initMenu(config, viewerApi) {
  const list = document.getElementById('sceneGroupList');
  if (!list) return;

  const grouped = groupScenes(config.scenes);
  list.innerHTML = '';

  Object.entries(grouped).forEach(([zoneKey, scenes]) => {
    const groupItem = createGroupItem(zoneKey, scenes, config, viewerApi);
    list.appendChild(groupItem);
  });

  setupMenuToggle();
  setupMenuKeyboard();
  initSceneMenuState();
}

function groupScenes(scenes) {
  return scenes.reduce((acc, scene) => {
    const zone = scene.zone || 'sin-zona';
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(scene);
    return acc;
  }, {});
}

let groupSeq = 0;

function createGroupItem(zoneKey, scenes, config, viewerApi) {
  const zoneLabel = config.zones?.[zoneKey] || zoneKey;
  const sublistId = `sceneGroup-${++groupSeq}`;

  /* Patrón de "disclosure" nativo, no `role="tree"`.
     El árbol anterior estaba a medias: el `li[role=treeitem]` no era enfocable,
     el control real era un `<button>` (contenido no permitido en un treeitem) y
     no existía navegación con flechas ni tabindex móvil. Un botón con
     `aria-expanded` + `aria-controls` sobre una lista es lo que los lectores de
     pantalla anuncian correctamente sin implementar el patrón completo. */
  const item = document.createElement('li');
  item.className = 'scene-group';

  const headerButton = document.createElement('button');
  headerButton.type = 'button';
  headerButton.className = 'scene-group__header';
  headerButton.setAttribute('aria-expanded', 'false');
  headerButton.setAttribute('aria-controls', sublistId);
  headerButton.innerHTML = `
    <span class="scene-group__name"></span>
    <span class="scene-group__toggle" aria-hidden="true">+</span>
  `;
  // textContent: el nombre de zona es dato de Convex, no plantilla de confianza.
  headerButton.querySelector('.scene-group__name').textContent = zoneLabel;
  item.appendChild(headerButton);

  const sceneList = document.createElement('ul');
  sceneList.className = 'scene-sublist';
  sceneList.id = sublistId;
  sceneList.hidden = true;

  scenes
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach((scene) => {
      const sceneItem = document.createElement('li');
      sceneItem.className = 'scene-sublist__item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scene-button';
      button.dataset.sceneId = scene.id;
      button.textContent = scene.shortTitle || scene.title;

      // Enter/Space ya los dispara `click` en un <button> nativo; duplicarlo
      // provocaba doble cambio de escena.
      button.addEventListener('click', () => {
        viewerApi.switchScene(scene.id);
        closeMenuOnSelection();
      });

      sceneItem.appendChild(button);
      sceneList.appendChild(sceneItem);
    });

  item.appendChild(sceneList);

  headerButton.addEventListener('click', () => {
    const expanded = headerButton.getAttribute('aria-expanded') === 'true';
    headerButton.setAttribute('aria-expanded', String(!expanded));
    headerButton.querySelector('.scene-group__toggle').textContent = expanded ? '+' : '−';
    sceneList.hidden = expanded;
  });

  return item;
}

function setupMenuToggle() {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('sceneMenu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      dismissOpenLayers();
      toggle.focus();
      return;
    }
    openSceneMenu();
  });
}

/**
 * Teclado dentro del cajón: Tab cicla (el cajón tapa el visor en móvil),
 * flechas recorren los controles, Home/End saltan a los extremos y Escape
 * cierra devolviendo el foco al disparador.
 */
function setupMenuKeyboard() {
  const menu = document.getElementById('sceneMenu');
  if (!menu) return;

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      // Sólo se atrapa el Tab cuando el cajón es modal (móvil a sangre completa).
      // En escritorio es un panel lateral y salir con Tab es lo esperado.
      if (drawerIsModal()) trapFocusWithin(menu, event);
      return;
    }

    if (event.key === 'Escape') {
      // El guard global también cierra; aquí sólo se evita doble manejo.
      event.stopPropagation();
      dismissOpenLayers();
      document.getElementById('menuToggle')?.focus();
      return;
    }

    const isArrow = event.key === 'ArrowDown' || event.key === 'ArrowUp';
    if (!isArrow && event.key !== 'Home' && event.key !== 'End') return;

    const items = Array.from(
      menu.querySelectorAll('.scene-group__header, .scene-button')
    ).filter((el) => !el.closest('[hidden]'));
    if (items.length === 0) return;

    event.preventDefault();
    const index = items.indexOf(document.activeElement);

    if (event.key === 'Home') {
      items[0].focus();
      return;
    }
    if (event.key === 'End') {
      items[items.length - 1].focus();
      return;
    }

    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const next = index < 0 ? 0 : (index + delta + items.length) % items.length;
    items[next].focus();
  });
}

function closeMenuOnSelection() {
  dismissOpenLayers();
  // Tras elegir escena el foco debe ir al título de la escena nueva, no al body.
  const title = document.getElementById('sceneTitle');
  if (title) title.focus();
}


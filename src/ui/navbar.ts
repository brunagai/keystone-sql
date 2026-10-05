import { showMobilePane } from './layout.ts';

const FLOATING_MENU_IDS = ['history-panel', 'export-menu', 'selection-help'] as const;

/** Fecha popovers da chrome antes de qualquer init, para não ficarem soltos se o JS interromper. */
export function hideFloatingMenus(): void {
  for (const id of FLOATING_MENU_IDS) {
    const node = document.getElementById(id);
    if (!node) continue;
    node.hidden = true;
  }
}

function enableHorizontalScroll(node: HTMLElement): void {
  node.classList.add('overflow-x-auto', 'flex-nowrap', 'scrollbar-none');
  node.style.scrollbarWidth = 'none';
}

/**
 * Seletor `#scenario-select` (preenchido em `investigationPanel`):
 * trilha 0–5; filtro Iniciante = níveis 0–2; carga inicial = Caso 0.1.
 */
export function initNavbar(): HTMLSelectElement | null {
  hideFloatingMenus();

  const header = document.getElementById('app-header');
  if (header) {
    header.classList.add('overflow-x-auto', 'flex-nowrap', 'scrollbar-none', 'max-md:h-auto', 'max-md:min-h-16');
    header.style.scrollbarWidth = 'none';
  }

  const tools = header?.querySelector<HTMLElement>(':scope > div.min-w-0');
  if (tools) {
    enableHorizontalScroll(tools);
    tools.classList.add('max-md:shrink-0');
  }

  const trail = document.getElementById('trail-bands');
  if (trail) {
    enableHorizontalScroll(trail);
    for (const button of trail.querySelectorAll('button')) {
      button.classList.add('shrink-0', 'max-md:min-h-10');
    }
  }

  const select = document.getElementById('scenario-select');
  if (select instanceof HTMLSelectElement) {
    select.classList.add('shrink-0', 'max-md:min-h-10', 'max-md:min-w-52');
  }

  const nav = header?.querySelector('nav');
  if (nav) {
    enableHorizontalScroll(nav);
    for (const button of nav.querySelectorAll('button')) {
      button.classList.add('shrink-0', 'max-md:min-h-10');
    }
  }

  const schemaButton = document.getElementById('btn-schema');
  schemaButton?.addEventListener('click', () => showMobilePane('mission'));

  const selectEl = document.getElementById('scenario-select');
  return selectEl instanceof HTMLSelectElement ? selectEl : null;
}
